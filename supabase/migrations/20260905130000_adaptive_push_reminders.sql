begin;
alter table public.push_notification_outbox add column accepted_subscription_ids uuid[] not null default '{}'::uuid[];
alter table public.hydration_notification_preferences add column reminder_frequency text not null default 'balanced'
  check (reminder_frequency in ('gentle', 'balanced', 'frequent'));
grant insert (reminder_frequency), update (reminder_frequency) on public.hydration_notification_preferences to authenticated;
alter table public.hydration_reminder_state drop constraint hydration_reminder_state_count_check;
alter table public.hydration_reminder_state add constraint hydration_reminder_state_count_check check (reminder_count between 0 and 8);
alter table public.hydration_reminder_state add column last_suppression_reason text,
  add column next_eligible_at timestamptz, add column evaluated_pace_status text;
drop function public.set_hydration_notification_preferences(boolean);
create or replace function public.set_hydration_notification_preferences(
  p_pace_reminders_enabled boolean,
  p_reminder_frequency text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_preferences public.hydration_notification_preferences%rowtype;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  insert into public.hydration_notification_preferences as preferences (
    user_id,
    pace_reminders_enabled,
    reminder_frequency
  )
  values (
    v_user_id,
    p_pace_reminders_enabled,
    coalesce(p_reminder_frequency, 'balanced')
  )
  on conflict (user_id) do update
  set pace_reminders_enabled = excluded.pace_reminders_enabled,
      reminder_frequency = coalesce(p_reminder_frequency, preferences.reminder_frequency)
  returning preferences.* into v_preferences;

  return pg_catalog.jsonb_build_object(
    'pace_reminders_enabled', v_preferences.pace_reminders_enabled,
    'updated_at', v_preferences.updated_at
  );
end;
$$;

revoke all on function public.set_hydration_notification_preferences(boolean, text)
from public, anon;

grant execute on function public.set_hydration_notification_preferences(boolean, text)
to authenticated;

drop function public.apply_push_reminder_evaluation(text, uuid, uuid, text, boolean, text, text, timestamptz);
create or replace function public.claim_push_reminder_evaluations(
  p_worker_secret text,
  p_now timestamptz default pg_catalog.now(),
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_state public.hydration_reminder_state%rowtype;
  v_local_date date;
  v_token uuid;
  v_goal_ml integer;
  v_goal_target_completion_time time;
  v_normal_fill_ml integer;
  v_today_intake_ml bigint;
  v_last_hydration_at timestamptz;
  v_results jsonb := '[]'::jsonb;
begin
  if not public.push_worker_is_authorized(p_worker_secret) then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  for v_candidate in
    select
      preferences.user_id,
      preferences.reminder_frequency,
      profiles.timezone,
      profiles.preferred_unit,
      profiles.wake_time,
      profiles.target_completion_time
    from public.hydration_notification_preferences as preferences
    inner join public.profiles
      on profiles.id = preferences.user_id
    left join public.hydration_reminder_state as existing_state
      on existing_state.user_id = preferences.user_id
    where preferences.pace_reminders_enabled
      and exists (
        select 1
        from public.web_push_subscriptions as subscriptions
        where subscriptions.user_id = preferences.user_id
          and subscriptions.revoked_at is null
          and (
            subscriptions.expires_at is null
            or subscriptions.expires_at > p_now
          )
      )
    order by existing_state.last_evaluated_at asc nulls first, preferences.user_id
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    v_local_date := (p_now at time zone v_candidate.timezone)::date;

    insert into public.hydration_reminder_state (user_id, local_date)
    values (v_candidate.user_id, v_local_date)
    on conflict (user_id) do nothing;

    select reminder_state.*
    into v_state
    from public.hydration_reminder_state as reminder_state
    where reminder_state.user_id = v_candidate.user_id
    for update;

    if v_state.local_date is distinct from v_local_date then
      if v_state.pending_outbox_id is not null then
        update public.push_notification_outbox
        set status = 'cancelled', last_error_code = 'LOCAL_DAY_ENDED'
        where id = v_state.pending_outbox_id
          and status in ('pending', 'processing', 'retry');
      end if;

      update public.hydration_reminder_state
      set
        local_date = v_local_date,
        last_pace_status = null,
        behind_episode = 0,
        outbox_sequence = 0,
        reminder_count = 0,
        evaluated_pace_status = null,
        last_suppression_reason = null,
        next_eligible_at = null,
        last_evaluated_at = null,
        evaluation_token = null,
        pending_outbox_id = null,
        updated_at = p_now
      where user_id = v_candidate.user_id
      returning * into v_state;
    end if;

    if v_state.pending_outbox_id is not null
      or (
        v_state.last_evaluated_at is not null
        and v_state.last_evaluated_at > p_now - interval '5 minutes'
      )
    then
      continue;
    end if;

    select
      hydration_goals.daily_goal_ml,
      hydration_goals.target_completion_time
    into
      v_goal_ml,
      v_goal_target_completion_time
    from public.hydration_goals
    where hydration_goals.user_id = v_candidate.user_id
      and hydration_goals.effective_from <= v_local_date
      and (
        hydration_goals.effective_until is null
        or hydration_goals.effective_until >= v_local_date
      )
    order by hydration_goals.effective_from desc, hydration_goals.created_at desc
    limit 1;

    select coalesce(bottles.typical_fill_ml, bottles.capacity_ml)
    into v_normal_fill_ml
    from public.bottles
    where bottles.user_id = v_candidate.user_id
      and bottles.is_primary
      and bottles.archived_at is null
    order by bottles.updated_at desc, bottles.id
    limit 1;

    select greatest(
      0,
      coalesce(
        pg_catalog.sum(
          case
            when hydration_events.event_type = 'fill_started' then 0
            else hydration_events.volume_ml
          end
        ),
        0
      )
    )::bigint
    into v_today_intake_ml
    from public.hydration_events
    where hydration_events.user_id = v_candidate.user_id
      and hydration_events.occurred_at <= p_now
      and (
        hydration_events.occurred_at at time zone v_candidate.timezone
      )::date = v_local_date
      and hydration_events.event_type <> 'event_reversed'
      and not exists (
        select 1
        from public.hydration_events as reversals
        where reversals.user_id = v_candidate.user_id
          and reversals.event_type = 'event_reversed'
          and reversals.reverses_event_id = hydration_events.id
          and reversals.occurred_at <= p_now
      );

    select hydration_events.occurred_at
    into v_last_hydration_at
    from public.hydration_events
    where hydration_events.user_id = v_candidate.user_id
      and hydration_events.occurred_at <= p_now
      and hydration_events.event_type in (
        'refill',
        'bottle_finished',
        'bottle_completed',
        'manual_intake'
      )
      and hydration_events.volume_ml > 0
      and not exists (
        select 1
        from public.hydration_events as reversals
        where reversals.user_id = v_candidate.user_id
          and reversals.event_type = 'event_reversed'
          and reversals.reverses_event_id = hydration_events.id
          and reversals.occurred_at <= p_now
      )
    order by hydration_events.occurred_at desc, hydration_events.received_at desc
    limit 1;

    v_token := pg_catalog.gen_random_uuid();

    update public.hydration_reminder_state
    set
      evaluation_token = v_token,
      last_evaluated_at = p_now,
      updated_at = p_now
    where user_id = v_candidate.user_id;

    v_results := v_results || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'user_id', v_candidate.user_id,
        'evaluation_token', v_token,
        'timezone', v_candidate.timezone,
        'reminder_frequency', v_candidate.reminder_frequency,
        'preferred_unit', v_candidate.preferred_unit,
        'wake_time', v_candidate.wake_time,
        'target_completion_time', coalesce(
          v_goal_target_completion_time,
          v_candidate.target_completion_time
        ),
        'local_date', v_local_date,
        'goal_ml', v_goal_ml,
        'normal_fill_ml', v_normal_fill_ml,
        'today_intake_ml', v_today_intake_ml,
        'last_hydration_at', v_last_hydration_at,
        'last_pace_status', v_state.last_pace_status,
        'behind_episode', v_state.behind_episode,
        'reminder_count', v_state.reminder_count,
        'last_reminder_attempted_at', v_state.last_reminder_attempted_at,
        'last_reminder_sent_at', v_state.last_reminder_sent_at
      )
    );
  end loop;

  return pg_catalog.jsonb_build_object('candidates', v_results);
end;
$$;

create or replace function public.apply_push_reminder_evaluation(
  p_worker_secret text,
  p_user_id uuid,
  p_evaluation_token uuid,
  p_pace_status text,
  p_should_send boolean,
  p_title text default null,
  p_body text default null,
  p_now timestamptz default pg_catalog.now(),
  p_reason text default null,
  p_next_eligible_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.hydration_reminder_state%rowtype;
  v_episode integer;
  v_outbox_id uuid;
  v_dedupe_key text;
  v_outbox_sequence integer;
begin
  if not public.push_worker_is_authorized(p_worker_secret) then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_pace_status not in (
    'ahead',
    'behind',
    'goal-reached',
    'not-configured',
    'on-track',
    'outside-window',
    'recent-hydration'
  ) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select reminder_state.*
  into v_state
  from public.hydration_reminder_state as reminder_state
  where reminder_state.user_id = p_user_id
  for update;

  if not found or v_state.evaluation_token is distinct from p_evaluation_token then
    return pg_catalog.jsonb_build_object('applied', false, 'enqueued', false);
  end if;

  v_episode := v_state.behind_episode;
  if p_should_send
    and p_pace_status = 'behind'
    and v_state.last_pace_status is distinct from 'behind'
  then
    v_episode := v_episode + 1;
  end if;

  if p_should_send then
    if p_pace_status not in ('behind', 'on-track', 'ahead')
      or p_title is null
      or pg_catalog.char_length(p_title) not between 1 and 80
      or p_body is null
      or pg_catalog.char_length(p_body) not between 1 and 180
      or v_state.reminder_count >= (select case reminder_frequency when 'gentle' then 4 when 'frequent' then 8 else 6 end from public.hydration_notification_preferences where user_id = p_user_id)
      or v_state.pending_outbox_id is not null
    then
      raise exception 'VALIDATION_ERROR' using errcode = '22023';
    end if;

    v_outbox_sequence := v_state.outbox_sequence + 1;
    v_dedupe_key := p_user_id::text
      || ':' || v_state.local_date::text
      || ':' || v_outbox_sequence::text;

    insert into public.push_notification_outbox (
      user_id,
      local_date,
      dedupe_key,
      notification,
      available_at
    )
    values (
      p_user_id,
      v_state.local_date,
      v_dedupe_key,
      pg_catalog.jsonb_build_object(
        'version', 1,
        'kind', 'pace-reminder',
        'title', p_title,
        'body', p_body,
        'target', '/today?record=1&source=push',
        'tag', 'hydropop-pace'
      ),
      p_now
    )
    returning id into v_outbox_id;
  end if;

  update public.hydration_reminder_state
  set
    last_pace_status = case
      when p_pace_status = 'behind'
        and v_state.last_pace_status is distinct from 'behind'
        and not p_should_send
      then v_state.last_pace_status
      else p_pace_status
    end,
    evaluated_pace_status = p_pace_status,
    last_suppression_reason = p_reason,
    next_eligible_at = p_next_eligible_at,
    behind_episode = v_episode,
    outbox_sequence = coalesce(v_outbox_sequence, outbox_sequence),
    evaluation_token = null,
    pending_outbox_id = v_outbox_id,
    last_reminder_attempted_at = case
      when v_outbox_id is not null then p_now
      else last_reminder_attempted_at
    end,
    updated_at = p_now
  where user_id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'enqueued', v_outbox_id is not null
  );
end;
$$;

create or replace function public.claim_push_notification_outbox(
  p_worker_secret text,
  p_now timestamptz default pg_catalog.now(),
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_claim_token uuid;
  v_results jsonb := '[]'::jsonb;
  v_subscriptions jsonb;
begin
  if not public.push_worker_is_authorized(p_worker_secret) then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  update public.push_notification_outbox as o
  set status = 'cancelled', claim_token = null, last_error_code = 'NO_LONGER_ELIGIBLE'
  where o.status in ('pending', 'retry', 'processing') and (
    not exists (select 1 from public.hydration_notification_preferences p where p.user_id = o.user_id and p.pace_reminders_enabled)
    or o.local_date <> (p_now at time zone (select timezone from public.profiles where id = o.user_id))::date
    or exists (
      select 1 from public.profiles p
      left join lateral (
        select daily_goal_ml, target_completion_time from public.hydration_goals
        where user_id = p.id and effective_from <= o.local_date
          and (effective_until is null or effective_until >= o.local_date)
        order by effective_from desc, created_at desc limit 1
      ) g on true
      where p.id = o.user_id and (
        g.daily_goal_ml is null or p.wake_time is null
        or p_now < ((o.local_date + p.wake_time) at time zone p.timezone)
        or p_now >= ((o.local_date + case when coalesce(g.target_completion_time, p.target_completion_time) <= p.wake_time then 1 else 0 end + coalesce(g.target_completion_time, p.target_completion_time)) at time zone p.timezone)
        or g.daily_goal_ml <= (
          select coalesce(sum(e.volume_ml), 0) from public.hydration_events e
          where e.user_id = p.id and (e.occurred_at at time zone p.timezone)::date = o.local_date
            and e.occurred_at <= p_now and e.event_type not in ('event_reversed', 'fill_started')
            and not exists (select 1 from public.hydration_events r where r.reverses_event_id = e.id and r.event_type = 'event_reversed' and r.occurred_at <= p_now)
        )
        or exists (
          select 1 from public.hydration_events e where e.user_id = p.id
            and e.volume_ml > 0 and e.event_type not in ('event_reversed', 'fill_started')
            and e.occurred_at > o.created_at and e.occurred_at <= p_now
            and not exists (select 1 from public.hydration_events r where r.reverses_event_id = e.id and r.event_type = 'event_reversed' and r.occurred_at <= p_now)
        )
      )
    )
  );
  update public.push_notification_outbox
  set status = 'failed', claim_token = null, last_error_code = 'RETRY_EXHAUSTED'
  where status = 'processing' and claimed_at < p_now - interval '15 minutes' and attempts >= 5;
  update public.hydration_reminder_state s
  set pending_outbox_id = null
  where exists (select 1 from public.push_notification_outbox o where o.id = s.pending_outbox_id and o.status in ('cancelled', 'failed'));

  update public.push_notification_outbox
  set
    status = 'retry',
    claim_token = null,
    available_at = p_now,
    last_error_code = 'STALE_CLAIM_RECOVERED'
  where status = 'processing'
    and claimed_at < p_now - interval '15 minutes';

  for v_item in
    select outbox.id, outbox.user_id, outbox.notification, outbox.attempts, outbox.accepted_subscription_ids
    from public.push_notification_outbox as outbox
    where outbox.status in ('pending', 'retry')
      and outbox.available_at <= p_now
    order by outbox.available_at, outbox.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 50))
  loop
    v_claim_token := pg_catalog.gen_random_uuid();

    update public.push_notification_outbox
    set
      status = 'processing',
      attempts = attempts + 1,
      claim_token = v_claim_token,
      claimed_at = p_now
    where id = v_item.id;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', subscriptions.id,
          'endpoint', subscriptions.endpoint,
          'p256dh', subscriptions.p256dh,
          'auth', subscriptions.auth
        )
        order by subscriptions.created_at
      ),
      '[]'::jsonb
    )
    into v_subscriptions
    from (
      select
        active_subscriptions.id,
        active_subscriptions.endpoint,
        active_subscriptions.p256dh,
        active_subscriptions.auth,
        active_subscriptions.created_at
      from public.web_push_subscriptions as active_subscriptions
      where active_subscriptions.user_id = v_item.user_id
        and active_subscriptions.revoked_at is null
        and not (active_subscriptions.id = any(v_item.accepted_subscription_ids))
        and (
          active_subscriptions.expires_at is null
          or active_subscriptions.expires_at > p_now
        )
      order by active_subscriptions.updated_at desc, active_subscriptions.id
      limit 10
    ) as subscriptions;

    v_results := v_results || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', v_item.id,
        'claim_token', v_claim_token,
        'attempt', v_item.attempts + 1,
        'notification', v_item.notification,
        'subscriptions', v_subscriptions
      )
    );
  end loop;

  return pg_catalog.jsonb_build_object('deliveries', v_results);
end;
$$;

create or replace function public.complete_push_notification_outbox(
  p_worker_secret text,
  p_outbox_id uuid,
  p_claim_token uuid,
  p_accepted_count integer,
  p_success_subscription_ids uuid[] default '{}'::uuid[],
  p_permanent_failure_subscription_ids uuid[] default '{}'::uuid[],
  p_error_code text default null,
  p_retry_at timestamptz default null,
  p_now timestamptz default pg_catalog.now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox public.push_notification_outbox%rowtype;
  v_next_status text;
begin
  if not public.push_worker_is_authorized(p_worker_secret) then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_accepted_count < 0 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select outbox.*
  into v_outbox
  from public.push_notification_outbox as outbox
  where outbox.id = p_outbox_id
  for update;

  if not found
    or v_outbox.status <> 'processing'
    or v_outbox.claim_token is distinct from p_claim_token
  then
    return pg_catalog.jsonb_build_object('completed', false);
  end if;

  update public.web_push_subscriptions
  set
    revoked_at = p_now,
    failure_count = failure_count + 1
  where user_id = v_outbox.user_id
    and id = any(p_permanent_failure_subscription_ids)
    and revoked_at is null;

  if p_accepted_count > 0 then
    v_next_status := case when p_retry_at is not null and v_outbox.attempts < 5 then 'retry' else 'delivered' end;

    update public.web_push_subscriptions
    set last_success_at = p_now, failure_count = 0
    where user_id = v_outbox.user_id
      and id = any(p_success_subscription_ids)
      and revoked_at is null;

    update public.hydration_reminder_state
    set
      reminder_count = least(8, reminder_count + case when cardinality(v_outbox.accepted_subscription_ids) = 0 then 1 else 0 end),
      last_reminder_sent_at = p_now,
      pending_outbox_id = case when v_next_status = 'retry' then v_outbox.id else null end,
      updated_at = p_now
    where user_id = v_outbox.user_id
      and pending_outbox_id = v_outbox.id;
  elsif p_retry_at is not null and v_outbox.attempts < 5 then
    v_next_status := 'retry';
  else
    v_next_status := case when cardinality(v_outbox.accepted_subscription_ids) > 0 then 'delivered' else 'failed' end;

    update public.hydration_reminder_state
    set pending_outbox_id = null, updated_at = p_now
    where user_id = v_outbox.user_id
      and pending_outbox_id = v_outbox.id;
  end if;

  update public.push_notification_outbox
  set
    accepted_subscription_ids = accepted_subscription_ids || p_success_subscription_ids,
    status = v_next_status,
    available_at = coalesce(p_retry_at, available_at),
    delivered_at = case when v_next_status = 'delivered' then p_now else null end,
    last_error_code = p_error_code,
    claim_token = null
  where id = v_outbox.id;

  return pg_catalog.jsonb_build_object(
    'completed', true,
    'status', v_next_status
  );
end;
$$;
revoke all on function public.apply_push_reminder_evaluation(text, uuid, uuid, text, boolean, text, text, timestamptz, text, timestamptz) from public, authenticated;
grant execute on function public.apply_push_reminder_evaluation(text, uuid, uuid, text, boolean, text, text, timestamptz, text, timestamptz) to anon;
create function public.get_push_reminder_diagnostics()
returns jsonb language sql stable security definer set search_path = '' as $$
select pg_catalog.jsonb_build_object(
  'last_evaluated_at', s.last_evaluated_at,
  'pace_status', s.evaluated_pace_status,
  'last_reminder_at', s.last_reminder_sent_at,
  'next_eligible_at', s.next_eligible_at,
  'reminders_today', case when s.local_date = (pg_catalog.now() at time zone p.timezone)::date then coalesce(s.reminder_count, 0) else 0 end,
  'window_start', p.wake_time,
  'window_end', coalesce((select g.target_completion_time from public.hydration_goals g where g.user_id = p.id and g.effective_from <= (pg_catalog.now() at time zone p.timezone)::date and (g.effective_until is null or g.effective_until >= (pg_catalog.now() at time zone p.timezone)::date) order by g.effective_from desc, g.created_at desc limit 1), p.target_completion_time),
  'timezone', p.timezone,
  'last_push_accepted_at', (select max(last_success_at) from public.web_push_subscriptions where user_id = auth.uid()),
  'reason', case
    when not coalesce(n.pace_reminders_enabled, false) then 'notifications_disabled'
    when not exists (select 1 from public.web_push_subscriptions w where w.user_id = p.id and w.revoked_at is null and (w.expires_at is null or w.expires_at > pg_catalog.now())) then 'no_active_subscription'
    when s.pending_outbox_id is not null then 'pending_delivery'
    when s.last_evaluated_at is null or s.last_evaluated_at < pg_catalog.now() - interval '30 minutes' then 'worker_not_run'
    else s.last_suppression_reason end
) from public.profiles p
left join public.hydration_reminder_state s on s.user_id = p.id
left join public.hydration_notification_preferences n on n.user_id = p.id
where p.id = auth.uid();
$$;
revoke all on function public.get_push_reminder_diagnostics() from public, anon;
grant execute on function public.get_push_reminder_diagnostics() to authenticated;
commit;

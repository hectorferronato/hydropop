begin;

create table public.web_push_subscriptions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  endpoint_hash text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  expires_at timestamptz,
  last_success_at timestamptz,
  failure_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint web_push_subscriptions_endpoint_hash_key unique (endpoint_hash),
  constraint web_push_subscriptions_user_endpoint_key unique (user_id, endpoint_hash),
  constraint web_push_subscriptions_endpoint_check check (
    pg_catalog.char_length(endpoint) between 12 and 2048
    and endpoint ~ '^https://'
  ),
  constraint web_push_subscriptions_endpoint_hash_check check (
    endpoint_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint web_push_subscriptions_keys_check check (
    pg_catalog.char_length(p256dh) between 16 and 512
    and pg_catalog.char_length(auth) between 8 and 256
  ),
  constraint web_push_subscriptions_client_metadata_check check (
    (user_agent is null or pg_catalog.char_length(user_agent) <= 500)
    and (platform is null or pg_catalog.char_length(platform) <= 32)
  ),
  constraint web_push_subscriptions_failure_count_check check (failure_count >= 0)
);

create index web_push_subscriptions_active_user_idx
  on public.web_push_subscriptions (user_id, updated_at desc)
  where revoked_at is null;

create table public.hydration_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pace_reminders_enabled boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.hydration_reminder_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  local_date date,
  last_pace_status text,
  behind_episode integer not null default 0,
  outbox_sequence integer not null default 0,
  reminder_count integer not null default 0,
  last_reminder_attempted_at timestamptz,
  last_reminder_sent_at timestamptz,
  last_evaluated_at timestamptz,
  evaluation_token uuid,
  pending_outbox_id uuid,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint hydration_reminder_state_status_check check (
    last_pace_status is null
    or last_pace_status in (
      'ahead',
      'behind',
      'goal-reached',
      'not-configured',
      'on-track',
      'outside-window',
      'recent-hydration'
    )
  ),
  constraint hydration_reminder_state_episode_check check (behind_episode >= 0),
  constraint hydration_reminder_state_outbox_sequence_check check (outbox_sequence >= 0),
  constraint hydration_reminder_state_count_check check (
    reminder_count between 0 and 4
  )
);

create table public.push_notification_outbox (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  dedupe_key text not null,
  notification jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default pg_catalog.now(),
  claim_token uuid,
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint push_notification_outbox_dedupe_key_key unique (dedupe_key),
  constraint push_notification_outbox_dedupe_key_check check (
    pg_catalog.char_length(dedupe_key) between 1 and 120
  ),
  constraint push_notification_outbox_notification_check check (
    pg_catalog.jsonb_typeof(notification) = 'object'
    and notification ->> 'version' = '1'
    and notification ->> 'kind' = 'pace-reminder'
    and pg_catalog.char_length(notification ->> 'title') between 1 and 80
    and pg_catalog.char_length(notification ->> 'body') between 1 and 180
    and notification ->> 'target' = '/today?record=1&source=push'
    and notification ->> 'tag' = 'hydropop-pace'
    and pg_catalog.octet_length(notification::text) <= 1024
  ),
  constraint push_notification_outbox_status_check check (
    status in ('pending', 'processing', 'retry', 'delivered', 'failed', 'cancelled')
  ),
  constraint push_notification_outbox_attempts_check check (attempts >= 0),
  constraint push_notification_outbox_error_code_check check (
    last_error_code is null
    or pg_catalog.char_length(last_error_code) between 1 and 80
  )
);

alter table public.hydration_reminder_state
  add constraint hydration_reminder_state_pending_outbox_fkey
  foreign key (pending_outbox_id)
  references public.push_notification_outbox(id)
  on delete set null;

create index push_notification_outbox_claim_idx
  on public.push_notification_outbox (available_at, created_at)
  where status in ('pending', 'retry');

alter table public.web_push_subscriptions enable row level security;
alter table public.hydration_notification_preferences enable row level security;
alter table public.hydration_reminder_state enable row level security;
alter table public.push_notification_outbox enable row level security;

revoke all on table public.web_push_subscriptions from public, anon, authenticated;
revoke all on table public.hydration_notification_preferences from public, anon, authenticated;
revoke all on table public.hydration_reminder_state from public, anon, authenticated;
revoke all on table public.push_notification_outbox from public, anon, authenticated;

grant select on table public.web_push_subscriptions to authenticated;
grant insert (
  user_id,
  endpoint,
  endpoint_hash,
  p256dh,
  auth,
  user_agent,
  platform,
  expires_at,
  revoked_at
) on public.web_push_subscriptions to authenticated;
grant update (
  endpoint,
  p256dh,
  auth,
  user_agent,
  platform,
  expires_at,
  revoked_at
) on public.web_push_subscriptions to authenticated;

grant select on table public.hydration_notification_preferences to authenticated;
grant insert (user_id, pace_reminders_enabled)
on public.hydration_notification_preferences to authenticated;
grant update (pace_reminders_enabled)
on public.hydration_notification_preferences to authenticated;

create policy "users read their own push subscriptions"
on public.web_push_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users register their own push subscriptions"
on public.web_push_subscriptions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update their own push subscriptions"
on public.web_push_subscriptions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users read their own notification preferences"
on public.hydration_notification_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users create their own notification preferences"
on public.hydration_notification_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update their own notification preferences"
on public.hydration_notification_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger web_push_subscriptions_set_updated_at
before update on public.web_push_subscriptions
for each row execute function public.set_updated_at();

create trigger hydration_notification_preferences_set_updated_at
before update on public.hydration_notification_preferences
for each row execute function public.set_updated_at();

create trigger push_notification_outbox_set_updated_at
before update on public.push_notification_outbox
for each row execute function public.set_updated_at();

create or replace function public.push_worker_is_authorized(p_worker_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_worker_secret is not null
    and p_worker_secret ~ '^[0-9a-fA-F]{64}$'
    and exists (
      select 1
      from vault.decrypted_secrets
      where decrypted_secrets.name = 'hydropop_push_worker_secret'
        and decrypted_secrets.decrypted_secret = p_worker_secret
    );
$$;

revoke execute on function public.push_worker_is_authorized(text)
from public, anon, authenticated;

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
        last_reminder_attempted_at = null,
        last_reminder_sent_at = null,
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
  p_now timestamptz default pg_catalog.now()
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
    if p_pace_status <> 'behind'
      or p_title is null
      or pg_catalog.char_length(p_title) not between 1 and 80
      or p_body is null
      or pg_catalog.char_length(p_body) not between 1 and 180
      or v_state.reminder_count >= 4
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
      notification
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
      )
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

  update public.push_notification_outbox
  set
    status = 'retry',
    claim_token = null,
    available_at = p_now,
    last_error_code = 'STALE_CLAIM_RECOVERED'
  where status = 'processing'
    and claimed_at < p_now - interval '15 minutes';

  for v_item in
    select outbox.id, outbox.user_id, outbox.notification, outbox.attempts
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
    v_next_status := 'delivered';

    update public.web_push_subscriptions
    set last_success_at = p_now, failure_count = 0
    where user_id = v_outbox.user_id
      and id = any(p_success_subscription_ids)
      and revoked_at is null;

    update public.hydration_reminder_state
    set
      reminder_count = least(4, reminder_count + 1),
      last_reminder_sent_at = p_now,
      pending_outbox_id = null,
      updated_at = p_now
    where user_id = v_outbox.user_id
      and pending_outbox_id = v_outbox.id;
  elsif p_retry_at is not null and v_outbox.attempts < 5 then
    v_next_status := 'retry';
  else
    v_next_status := 'failed';

    update public.hydration_reminder_state
    set pending_outbox_id = null, updated_at = p_now
    where user_id = v_outbox.user_id
      and pending_outbox_id = v_outbox.id;
  end if;

  update public.push_notification_outbox
  set
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

revoke execute on function public.claim_push_reminder_evaluations(text, timestamptz, integer)
from public, authenticated;
revoke execute on function public.apply_push_reminder_evaluation(text, uuid, uuid, text, boolean, text, text, timestamptz)
from public, authenticated;
revoke execute on function public.claim_push_notification_outbox(text, timestamptz, integer)
from public, authenticated;
revoke execute on function public.complete_push_notification_outbox(text, uuid, uuid, integer, uuid[], uuid[], text, timestamptz, timestamptz)
from public, authenticated;

grant execute on function public.claim_push_reminder_evaluations(text, timestamptz, integer)
to anon;
grant execute on function public.apply_push_reminder_evaluation(text, uuid, uuid, text, boolean, text, text, timestamptz)
to anon;
grant execute on function public.claim_push_notification_outbox(text, timestamptz, integer)
to anon;
grant execute on function public.complete_push_notification_outbox(text, uuid, uuid, integer, uuid[], uuid[], text, timestamptz, timestamptz)
to anon;

comment on table public.web_push_subscriptions is
  'Per-device Web Push endpoints and encryption keys. Owner-only through RLS; never returned by reminder APIs.';
comment on table public.hydration_reminder_state is
  'Server-only daily pace state. Reminder counts advance only after at least one push service accepts delivery.';
comment on table public.push_notification_outbox is
  'Server-only idempotent Web Push delivery outbox with bounded retries.';
comment on function public.claim_push_reminder_evaluations(text, timestamptz, integer) is
  'Vault-authenticated worker RPC returning bounded private inputs for server-side pace evaluation.';

commit;

begin;

create table public.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  is_visible boolean not null default true,
  joined_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint community_profiles_username_key unique (username),
  constraint community_profiles_username_normalized_check check (
    username = pg_catalog.lower(pg_catalog.btrim(username))
    and pg_catalog.char_length(username) between 3 and 30
    and username ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint community_profiles_username_not_reserved_check check (
    username <> all (
      array[
        'auth',
        'login',
        'logout',
        'api',
        'admin',
        'setup',
        'settings',
        'device',
        'devices',
        'today',
        'calendar',
        'trends',
        'community',
        'profile',
        'user',
        'users',
        'u',
        'new',
        'create',
        'undefined',
        'null',
        'support',
        'hydropop',
        'system'
      ]::text[]
    )
  ),
  constraint community_profiles_display_name_check check (
    display_name = pg_catalog.btrim(display_name)
    and pg_catalog.char_length(display_name) between 1 and 80
  )
);

create table public.community_username_reservations (
  username text primary key,
  user_id uuid references auth.users(id) on delete set null,
  reserved_at timestamptz not null default pg_catalog.now(),
  constraint community_username_reservations_username_normalized_check check (
    username = pg_catalog.lower(pg_catalog.btrim(username))
    and pg_catalog.char_length(username) between 3 and 30
    and username ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  )
);

create index community_profiles_visible_display_name_idx
  on public.community_profiles (
    (pg_catalog.lower(display_name)),
    username
  )
  where is_visible;

create index community_username_reservations_user_id_idx
  on public.community_username_reservations (user_id);

alter table public.community_profiles enable row level security;
alter table public.community_username_reservations enable row level security;

revoke all on table public.community_profiles from public, anon, authenticated;
revoke all on table public.community_username_reservations from public, anon, authenticated;

grant select (username, display_name, is_visible, joined_at)
on table public.community_profiles
to authenticated;
grant insert (user_id, username, display_name, is_visible)
on table public.community_profiles
to authenticated;
grant update (username, display_name, is_visible)
on table public.community_profiles
to authenticated;

create policy "community profiles are visible to authenticated members"
on public.community_profiles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or is_visible
);

create policy "users can join community as themselves"
on public.community_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update their own community profile"
on public.community_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_community_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke execute on function public.set_community_profile_updated_at() from public, anon, authenticated;

create trigger community_profiles_set_updated_at
before update on public.community_profiles
for each row
execute function public.set_community_profile_updated_at();

create or replace function public.reserve_community_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester uuid := auth.uid();
begin
  if v_requester is null or new.user_id <> v_requester then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    return new;
  end if;

  begin
    insert into public.community_username_reservations (username, user_id)
    values (new.username, new.user_id);
  exception
    when unique_violation then
      raise exception 'USERNAME_UNAVAILABLE' using errcode = 'P0001';
  end;

  return new;
end;
$$;

revoke execute on function public.reserve_community_username() from public, anon, authenticated;

create trigger community_profiles_reserve_username
before insert or update of username on public.community_profiles
for each row
execute function public.reserve_community_username();

create or replace function public.sync_community_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name
    and new.display_name is not null
    and pg_catalog.btrim(new.display_name) <> ''
  then
    update public.community_profiles
    set display_name = pg_catalog.btrim(new.display_name)
    where user_id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_community_display_name() from public, anon, authenticated;

create trigger profiles_sync_community_display_name
after update of display_name on public.profiles
for each row
execute function public.sync_community_display_name();

create or replace function public.get_my_community_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
    'username',
    community_profiles.username,
    'display_name',
    community_profiles.display_name,
    'is_visible',
    community_profiles.is_visible,
    'joined_at',
    community_profiles.joined_at
  )
  into v_result
  from public.community_profiles
  where community_profiles.user_id = v_user_id;

  return v_result;
end;
$$;

revoke execute on function public.get_my_community_profile() from public, anon;
grant execute on function public.get_my_community_profile() to authenticated;

create or replace function public.save_community_profile(
  p_username text,
  p_is_visible boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text := pg_catalog.lower(pg_catalog.btrim(p_username));
  v_display_name text;
  v_current_profile jsonb;
  v_current_username text;
  v_saved_username text;
  v_saved_display_name text;
  v_saved_is_visible boolean;
  v_saved_joined_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if v_username is null
    or pg_catalog.char_length(v_username) not between 3 and 30
    or v_username !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  then
    raise exception 'USERNAME_INVALID' using errcode = 'P0001';
  end if;

  if v_username = any (
      array[
        'auth',
        'login',
        'logout',
        'api',
        'admin',
        'setup',
        'settings',
        'device',
        'devices',
        'today',
        'calendar',
        'trends',
        'community',
        'profile',
        'user',
        'users',
        'u',
        'new',
        'create',
        'undefined',
        'null',
        'support',
        'hydropop',
        'system'
      ]::text[]
    )
  then
    raise exception 'USERNAME_RESERVED' using errcode = 'P0001';
  end if;

  select pg_catalog.btrim(profiles.display_name)
  into v_display_name
  from public.profiles
  where profiles.id = v_user_id;

  if v_display_name is null or v_display_name = '' then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  v_current_profile := public.get_my_community_profile();
  v_current_username := pg_catalog.jsonb_extract_path_text(
    v_current_profile,
    'username'
  );

  if v_current_username is null then
    insert into public.community_profiles (
      user_id,
      username,
      display_name,
      is_visible
    )
    values (
      v_user_id,
      v_username,
      v_display_name,
      coalesce(p_is_visible, false)
    )
    returning
      community_profiles.username,
      community_profiles.display_name,
      community_profiles.is_visible,
      community_profiles.joined_at
    into
      v_saved_username,
      v_saved_display_name,
      v_saved_is_visible,
      v_saved_joined_at;
  else
    update public.community_profiles
    set
      username = v_username,
      display_name = v_display_name,
      is_visible = coalesce(p_is_visible, false)
    where community_profiles.username = v_current_username
    returning
      community_profiles.username,
      community_profiles.display_name,
      community_profiles.is_visible,
      community_profiles.joined_at
    into
      v_saved_username,
      v_saved_display_name,
      v_saved_is_visible,
      v_saved_joined_at;
  end if;

  if v_saved_username is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'username',
    v_saved_username,
    'display_name',
    v_saved_display_name,
    'is_visible',
    v_saved_is_visible,
    'joined_at',
    v_saved_joined_at
  );
end;
$$;

revoke execute on function public.save_community_profile(text, boolean) from public, anon;
grant execute on function public.save_community_profile(text, boolean) to authenticated;

create or replace function public.check_community_username_availability(
  p_username text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text := pg_catalog.lower(pg_catalog.btrim(p_username));
  v_is_current boolean;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if v_username is null
    or pg_catalog.char_length(v_username) not between 3 and 30
    or v_username !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  then
    return pg_catalog.jsonb_build_object(
      'username',
      v_username,
      'available',
      false,
      'error_code',
      'USERNAME_INVALID'
    );
  end if;

  if v_username = any (
      array[
        'auth',
        'login',
        'logout',
        'api',
        'admin',
        'setup',
        'settings',
        'device',
        'devices',
        'today',
        'calendar',
        'trends',
        'community',
        'profile',
        'user',
        'users',
        'u',
        'new',
        'create',
        'undefined',
        'null',
        'support',
        'hydropop',
        'system'
      ]::text[]
    )
  then
    return pg_catalog.jsonb_build_object(
      'username',
      v_username,
      'available',
      false,
      'error_code',
      'USERNAME_RESERVED'
    );
  end if;

  select exists (
    select 1
    from public.community_profiles
    where community_profiles.user_id = v_user_id
      and community_profiles.username = v_username
  )
  into v_is_current;

  if v_is_current then
    return pg_catalog.jsonb_build_object(
      'username',
      v_username,
      'available',
      true,
      'error_code',
      null
    );
  end if;

  if exists (
    select 1
    from public.community_username_reservations
    where community_username_reservations.username = v_username
  ) then
    return pg_catalog.jsonb_build_object(
      'username',
      v_username,
      'available',
      false,
      'error_code',
      'USERNAME_UNAVAILABLE'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'username',
    v_username,
    'available',
    true,
    'error_code',
    null
  );
end;
$$;

revoke execute on function public.check_community_username_availability(text) from public, anon;
grant execute on function public.check_community_username_availability(text) to authenticated;

create or replace function public.community_member_daily_aggregate(
  p_user_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  hydration_day date,
  intake_ml bigint,
  goal_ml integer,
  completed_bottles bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with member as (
    select profiles.timezone
    from public.profiles
    where profiles.id = p_user_id
      and auth.uid() is not null
  ),
  days as (
    select generated_day::date as hydration_day
    from pg_catalog.generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      interval '1 day'
    ) as generated_day
  )
  select
    days.hydration_day,
    greatest(0, coalesce(event_totals.intake_ml, 0))::bigint as intake_ml,
    active_goal.daily_goal_ml as goal_ml,
    coalesce(event_totals.completed_bottles, 0)::bigint as completed_bottles
  from days
  cross join member
  left join lateral (
    select
      coalesce(
        sum(
          case
            when hydration_events.event_type = 'fill_started' then 0
            else hydration_events.volume_ml
          end
        ),
        0
      )::bigint as intake_ml,
      count(*) filter (
        where hydration_events.event_type = 'bottle_completed'
      )::bigint as completed_bottles
    from public.hydration_events
    where hydration_events.user_id = p_user_id
      and hydration_events.occurred_at <= pg_catalog.statement_timestamp()
      and (
        hydration_events.occurred_at at time zone member.timezone
      )::date = days.hydration_day
      and hydration_events.event_type <> 'event_reversed'
      and not exists (
        select 1
        from public.hydration_events as reversals
        where reversals.user_id = p_user_id
          and reversals.event_type = 'event_reversed'
          and reversals.reverses_event_id = hydration_events.id
          and reversals.occurred_at <= pg_catalog.statement_timestamp()
      )
  ) as event_totals on true
  left join lateral (
    select hydration_goals.daily_goal_ml
    from public.hydration_goals
    where hydration_goals.user_id = p_user_id
      and hydration_goals.effective_from <= days.hydration_day
      and (
        hydration_goals.effective_until is null
        or hydration_goals.effective_until >= days.hydration_day
      )
    order by hydration_goals.effective_from desc, hydration_goals.created_at desc
    limit 1
  ) as active_goal on true
  order by days.hydration_day;
$$;

revoke execute on function public.community_member_daily_aggregate(uuid, date, date)
from public, anon, authenticated;

create or replace function public.build_community_member_summary(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_requester uuid := auth.uid();
  v_username text;
  v_display_name text;
  v_joined_at timestamptz;
  v_timezone text;
  v_today date;
  v_first_event_date date;
  v_first_goal_date date;
  v_first_relevant_date date;
  v_summary_start date;
  v_summary_days integer;
  v_today_intake bigint := 0;
  v_today_goal integer;
  v_seven_day_average bigint := 0;
  v_goal_days integer := 0;
  v_goal_met_days integer := 0;
  v_completed_bottles bigint := 0;
  v_current_streak integer := 0;
  v_streak_anchor date;
  v_daily jsonb := '[]'::jsonb;
begin
  if v_requester is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select
    community_profiles.username,
    community_profiles.display_name,
    community_profiles.joined_at,
    profiles.timezone
  into
    v_username,
    v_display_name,
    v_joined_at,
    v_timezone
  from public.community_profiles
  inner join public.profiles
    on profiles.id = community_profiles.user_id
  where community_profiles.user_id = p_user_id;

  if not found then
    return null;
  end if;

  v_today := (pg_catalog.statement_timestamp() at time zone v_timezone)::date;

  select min(
    (hydration_events.occurred_at at time zone v_timezone)::date
  )
  into v_first_event_date
  from public.hydration_events
  where hydration_events.user_id = p_user_id
    and hydration_events.occurred_at <= pg_catalog.statement_timestamp()
    and hydration_events.event_type <> 'event_reversed'
    and not exists (
      select 1
      from public.hydration_events as reversals
      where reversals.user_id = p_user_id
        and reversals.event_type = 'event_reversed'
        and reversals.reverses_event_id = hydration_events.id
        and reversals.occurred_at <= pg_catalog.statement_timestamp()
    );

  select min(hydration_goals.effective_from)
  into v_first_goal_date
  from public.hydration_goals
  where hydration_goals.user_id = p_user_id
    and hydration_goals.effective_from <= v_today;

  if v_first_event_date is null then
    v_first_relevant_date := v_first_goal_date;
  elsif v_first_goal_date is null then
    v_first_relevant_date := v_first_event_date;
  else
    v_first_relevant_date := least(v_first_event_date, v_first_goal_date);
  end if;

  if v_first_relevant_date is null then
    v_summary_start := v_today;
    v_summary_days := 0;
  else
    v_summary_start := greatest(v_today - 6, v_first_relevant_date);
    v_summary_days := v_today - v_summary_start + 1;
  end if;

  select
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'date',
          daily.hydration_day,
          'intake_ml',
          daily.intake_ml,
          'goal_ml',
          daily.goal_ml
        )
        order by daily.hydration_day
      ),
      '[]'::jsonb
    ),
    coalesce(
      max(daily.intake_ml) filter (where daily.hydration_day = v_today),
      0
    ),
    max(daily.goal_ml) filter (where daily.hydration_day = v_today),
    case
      when v_summary_days = 0 then 0
      else pg_catalog.round(
        coalesce(sum(daily.intake_ml), 0)::numeric / v_summary_days
      )::bigint
    end,
    count(*) filter (where daily.goal_ml is not null)::integer,
    count(*) filter (
      where daily.goal_ml is not null
        and daily.intake_ml >= daily.goal_ml
    )::integer,
    coalesce(sum(daily.completed_bottles), 0)::bigint
  into
    v_daily,
    v_today_intake,
    v_today_goal,
    v_seven_day_average,
    v_goal_days,
    v_goal_met_days,
    v_completed_bottles
  from public.community_member_daily_aggregate(
    p_user_id,
    v_summary_start,
    v_today
  ) as daily;

  if v_today_goal is not null and v_today_intake >= v_today_goal then
    v_streak_anchor := v_today;
  else
    v_streak_anchor := v_today - 1;
  end if;

  if v_first_goal_date is not null and v_first_goal_date <= v_streak_anchor then
    with reverse_goal_days as (
      select
        daily.hydration_day,
        daily.goal_ml,
        daily.intake_ml,
        sum(
          case
            when daily.goal_ml is null or daily.intake_ml < daily.goal_ml then 1
            else 0
          end
        ) over (
          order by daily.hydration_day desc
          rows between unbounded preceding and current row
        ) as missed_days
      from public.community_member_daily_aggregate(
        p_user_id,
        v_first_goal_date,
        v_streak_anchor
      ) as daily
    )
    select count(*)::integer
    into v_current_streak
    from reverse_goal_days
    where reverse_goal_days.missed_days = 0
      and reverse_goal_days.goal_ml is not null
      and reverse_goal_days.intake_ml >= reverse_goal_days.goal_ml;
  end if;

  return pg_catalog.jsonb_build_object(
    'username',
    v_username,
    'display_name',
    v_display_name,
    'joined_at',
    v_joined_at,
    'today_intake_ml',
    v_today_intake,
    'today_goal_ml',
    v_today_goal,
    'current_streak',
    v_current_streak,
    'seven_day_average_ml',
    v_seven_day_average,
    'seven_day_goal_days',
    v_goal_met_days,
    'seven_day_eligible_days',
    v_goal_days,
    'completed_bottles_this_week',
    v_completed_bottles,
    'daily',
    v_daily
  );
end;
$$;

revoke execute on function public.build_community_member_summary(uuid)
from public, anon, authenticated;

create or replace function public.list_community_member_summaries(
  p_search text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_requester uuid := auth.uid();
  v_search text := pg_catalog.lower(pg_catalog.btrim(p_search));
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 50));
  v_member record;
  v_summary jsonb;
  v_members jsonb := '[]'::jsonb;
begin
  if v_requester is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  for v_member in
    select community_profiles.user_id
    from public.community_profiles
    where community_profiles.is_visible
      and (
        v_search is null
        or v_search = ''
        or pg_catalog.lower(community_profiles.display_name) like '%' || v_search || '%'
        or community_profiles.username like '%' || v_search || '%'
      )
    order by
      pg_catalog.lower(community_profiles.display_name),
      community_profiles.username
    limit v_limit
  loop
    v_summary := public.build_community_member_summary(v_member.user_id);

    if v_summary is not null then
      v_members := v_members || pg_catalog.jsonb_build_array(v_summary - 'daily');
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'members',
    v_members
  );
end;
$$;

revoke execute on function public.list_community_member_summaries(text, integer)
from public, anon;
grant execute on function public.list_community_member_summaries(text, integer)
to authenticated;

create or replace function public.get_community_member_summary(
  p_username text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_requester uuid := auth.uid();
  v_username text := pg_catalog.lower(pg_catalog.btrim(p_username));
  v_member_id uuid;
  v_summary jsonb;
begin
  if v_requester is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if v_username is null
    or pg_catalog.char_length(v_username) not between 3 and 30
    or v_username !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  then
    return pg_catalog.jsonb_build_object(
      'error_code',
      'COMMUNITY_MEMBER_UNAVAILABLE'
    );
  end if;

  select community_profiles.user_id
  into v_member_id
  from public.community_profiles
  where community_profiles.username = v_username
    and (
      community_profiles.is_visible
      or community_profiles.user_id = v_requester
    );

  if v_member_id is null then
    return pg_catalog.jsonb_build_object(
      'error_code',
      'COMMUNITY_MEMBER_UNAVAILABLE'
    );
  end if;

  v_summary := public.build_community_member_summary(v_member_id);

  if v_summary is null then
    return pg_catalog.jsonb_build_object(
      'error_code',
      'COMMUNITY_MEMBER_UNAVAILABLE'
    );
  end if;

  return v_summary;
end;
$$;

revoke execute on function public.get_community_member_summary(text) from public, anon;
grant execute on function public.get_community_member_summary(text) to authenticated;

comment on table public.community_profiles is
  'Explicit, member-facing Community identities. Private account fields remain in public.profiles.';

comment on table public.community_username_reservations is
  'Permanent username ownership history. This table has no client-readable policies or grants.';

comment on function public.list_community_member_summaries(text, integer) is
  'Returns a bounded directory of safe hydration aggregates for visible Community members.';

comment on function public.get_community_member_summary(text) is
  'Returns one safe member hydration aggregate or a generic unavailable result.';

commit;

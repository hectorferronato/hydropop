begin;

drop function if exists public.save_onboarding(
  text,
  text,
  text,
  time,
  time,
  integer,
  text,
  integer,
  text,
  text,
  boolean,
  uuid,
  integer
);

create function public.save_onboarding(
  p_display_name text,
  p_timezone text,
  p_preferred_unit text,
  p_wake_time time,
  p_target_completion_time time,
  p_daily_goal_ml integer,
  p_bottle_name text,
  p_bottle_capacity_ml integer,
  p_bottle_brand text,
  p_bottle_model text,
  p_bottle_is_primary boolean,
  p_bottle_id uuid default null,
  p_bottle_typical_fill_ml integer default null,
  p_pilot_token_hash text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_hydration_day date;
  v_bottle_id uuid;
  v_current_goal public.hydration_goals%rowtype;
  v_next_goal_date date;
  v_pilot_tag public.nfc_tags%rowtype;
  v_reserved_pilot_tag_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if nullif(pg_catalog.btrim(p_display_name), '') is null then
    raise exception 'Display name is required'
      using errcode = '22023';
  end if;

  if not public.is_valid_timezone(p_timezone) then
    raise exception 'A valid IANA timezone is required'
      using errcode = '22023';
  end if;

  if p_preferred_unit not in ('oz', 'ml') then
    raise exception 'Preferred unit must be oz or ml'
      using errcode = '22023';
  end if;

  if p_wake_time is null or p_target_completion_time is null then
    raise exception 'Wake time and target completion time are required'
      using errcode = '22023';
  end if;

  if p_daily_goal_ml <= 0 or p_bottle_capacity_ml <= 0 then
    raise exception 'Goal and bottle capacity must be positive'
      using errcode = '22023';
  end if;

  if p_bottle_typical_fill_ml is not null
    and (
      p_bottle_typical_fill_ml <= 0
      or p_bottle_typical_fill_ml > p_bottle_capacity_ml
    ) then
    raise exception 'Typical fill must be positive and no greater than capacity'
      using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(p_bottle_name), '') is null then
    raise exception 'Bottle name is required'
      using errcode = '22023';
  end if;

  if p_pilot_token_hash is not null
    and p_pilot_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A lowercase SHA-256 pilot token hash is required'
      using errcode = '22023';
  end if;

  if p_pilot_token_hash is not null and not p_bottle_is_primary then
    raise exception 'A primary bottle is required for pilot activation'
      using errcode = '22023';
  end if;

  v_hydration_day :=
    (statement_timestamp() at time zone p_timezone)::date;

  insert into public.profiles (
    id,
    display_name,
    timezone,
    preferred_unit,
    wake_time,
    target_completion_time
  )
  values (
    v_user_id,
    pg_catalog.btrim(p_display_name),
    p_timezone,
    p_preferred_unit,
    p_wake_time,
    p_target_completion_time
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    timezone = excluded.timezone,
    preferred_unit = excluded.preferred_unit,
    wake_time = excluded.wake_time,
    target_completion_time = excluded.target_completion_time;

  if p_bottle_id is null then
    select bottles.id
    into v_bottle_id
    from public.bottles
    where bottles.user_id = v_user_id
      and bottles.is_primary
      and bottles.archived_at is null
    order by bottles.created_at desc, bottles.id
    limit 1
    for update;

    if v_bottle_id is null then
      insert into public.bottles (
        user_id,
        name,
        brand,
        model,
        capacity_ml,
        typical_fill_ml,
        is_primary
      )
      values (
        v_user_id,
        pg_catalog.btrim(p_bottle_name),
        nullif(pg_catalog.btrim(p_bottle_brand), ''),
        nullif(pg_catalog.btrim(p_bottle_model), ''),
        p_bottle_capacity_ml,
        p_bottle_typical_fill_ml,
        false
      )
      returning id into v_bottle_id;
    else
      update public.bottles
      set
        name = pg_catalog.btrim(p_bottle_name),
        brand = nullif(pg_catalog.btrim(p_bottle_brand), ''),
        model = nullif(pg_catalog.btrim(p_bottle_model), ''),
        capacity_ml = p_bottle_capacity_ml,
        typical_fill_ml = p_bottle_typical_fill_ml
      where bottles.id = v_bottle_id
        and bottles.user_id = v_user_id;
    end if;
  else
    select bottles.id
    into v_bottle_id
    from public.bottles
    where bottles.id = p_bottle_id
      and bottles.user_id = v_user_id
      and bottles.archived_at is null
    for update;

    if v_bottle_id is null then
      raise exception 'Bottle does not belong to the authenticated user'
        using errcode = '42501';
    end if;

    update public.bottles
    set
      name = pg_catalog.btrim(p_bottle_name),
      brand = nullif(pg_catalog.btrim(p_bottle_brand), ''),
      model = nullif(pg_catalog.btrim(p_bottle_model), ''),
      capacity_ml = p_bottle_capacity_ml,
      typical_fill_ml = p_bottle_typical_fill_ml
    where bottles.id = v_bottle_id
      and bottles.user_id = v_user_id;
  end if;

  if p_bottle_is_primary then
    update public.bottles
    set is_primary = false
    where bottles.user_id = v_user_id
      and bottles.id <> v_bottle_id
      and bottles.is_primary
      and bottles.archived_at is null;
  end if;

  update public.bottles
  set is_primary = p_bottle_is_primary
  where bottles.id = v_bottle_id
    and bottles.user_id = v_user_id;

  select goals.*
  into v_current_goal
  from public.hydration_goals as goals
  where goals.user_id = v_user_id
    and goals.effective_from <= v_hydration_day
    and (
      goals.effective_until is null
      or goals.effective_until >= v_hydration_day
    )
  order by goals.effective_from desc, goals.created_at desc, goals.id
  limit 1
  for update;

  if v_current_goal.id is not null
    and v_current_goal.effective_from = v_hydration_day then
    update public.hydration_goals
    set
      daily_goal_ml = p_daily_goal_ml,
      target_completion_time = p_target_completion_time
    where hydration_goals.id = v_current_goal.id
      and hydration_goals.user_id = v_user_id;
  elsif v_current_goal.id is null
    or v_current_goal.daily_goal_ml is distinct from p_daily_goal_ml
    or v_current_goal.target_completion_time
      is distinct from p_target_completion_time then
    if v_current_goal.id is not null then
      update public.hydration_goals
      set effective_until = v_hydration_day - 1
      where hydration_goals.id = v_current_goal.id
        and hydration_goals.user_id = v_user_id;
    end if;

    select min(goals.effective_from)
    into v_next_goal_date
    from public.hydration_goals as goals
    where goals.user_id = v_user_id
      and goals.effective_from > v_hydration_day;

    insert into public.hydration_goals (
      user_id,
      daily_goal_ml,
      effective_from,
      effective_until,
      target_completion_time
    )
    values (
      v_user_id,
      p_daily_goal_ml,
      v_hydration_day,
      case
        when v_next_goal_date is null then null
        else v_next_goal_date - 1
      end,
      p_target_completion_time
    );
  end if;

  if p_pilot_token_hash is not null then
    select nfc_tags.*
    into v_pilot_tag
    from public.nfc_tags
    where nfc_tags.user_id = v_user_id
      and nfc_tags.friendly_code = 'pilot'
    for update;

    if v_pilot_tag.id is not null then
      if v_pilot_tag.status <> 'active' then
        raise exception 'Pilot NFC tag is unavailable'
          using errcode = 'P0001';
      end if;

      update public.nfc_tags
      set
        bottle_id = v_bottle_id,
        label = coalesce(nfc_tags.label, 'HydroPOP Pilot Tag')
      where nfc_tags.id = v_pilot_tag.id
        and nfc_tags.user_id = v_user_id;
    else
      select reservations.tag_id
      into v_reserved_pilot_tag_id
      from public.nfc_friendly_code_reservations as reservations
      where reservations.user_id = v_user_id
        and reservations.friendly_code = 'pilot';

      if v_reserved_pilot_tag_id is not null then
        raise exception 'Pilot NFC tag is unavailable'
          using errcode = 'P0001';
      end if;

      insert into public.nfc_tags (
        user_id,
        bottle_id,
        token_hash,
        label,
        friendly_code,
        status
      )
      values (
        v_user_id,
        v_bottle_id,
        p_pilot_token_hash,
        'HydroPOP Pilot Tag',
        'pilot',
        'active'
      );
    end if;
  end if;

  return v_bottle_id;
end;
$$;

create function public.activate_pilot_nfc_tag(
  p_token_hash text
)
returns public.nfc_tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_bottle_id uuid;
  v_pilot_tag public.nfc_tags%rowtype;
  v_reserved_pilot_tag_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A lowercase SHA-256 token hash is required'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select bottles.id
  into v_bottle_id
  from public.bottles
  where bottles.user_id = v_user_id
    and bottles.is_primary
    and bottles.archived_at is null
  order by bottles.created_at desc, bottles.id
  limit 1
  for update;

  if v_bottle_id is null then
    raise exception 'An active primary bottle is required'
      using errcode = 'P0002';
  end if;

  select nfc_tags.*
  into v_pilot_tag
  from public.nfc_tags
  where nfc_tags.user_id = v_user_id
    and nfc_tags.friendly_code = 'pilot'
  for update;

  if v_pilot_tag.id is not null then
    if v_pilot_tag.status <> 'active' then
      raise exception 'Pilot NFC tag is unavailable'
        using errcode = 'P0001';
    end if;

    update public.nfc_tags
    set
      bottle_id = v_bottle_id,
      label = coalesce(nfc_tags.label, 'HydroPOP Pilot Tag')
    where nfc_tags.id = v_pilot_tag.id
      and nfc_tags.user_id = v_user_id
    returning * into v_pilot_tag;

    return v_pilot_tag;
  end if;

  select reservations.tag_id
  into v_reserved_pilot_tag_id
  from public.nfc_friendly_code_reservations as reservations
  where reservations.user_id = v_user_id
    and reservations.friendly_code = 'pilot';

  if v_reserved_pilot_tag_id is not null then
    raise exception 'Pilot NFC tag is unavailable'
      using errcode = 'P0001';
  end if;

  insert into public.nfc_tags (
    user_id,
    bottle_id,
    token_hash,
    label,
    friendly_code,
    status
  )
  values (
    v_user_id,
    v_bottle_id,
    p_token_hash,
    'HydroPOP Pilot Tag',
    'pilot',
    'active'
  )
  returning * into v_pilot_tag;

  return v_pilot_tag;
end;
$$;

revoke execute on function public.save_onboarding(
  text,
  text,
  text,
  time,
  time,
  integer,
  text,
  integer,
  text,
  text,
  boolean,
  uuid,
  integer,
  text
) from public, anon;

revoke execute on function public.activate_pilot_nfc_tag(text)
from public, anon;

grant execute on function public.save_onboarding(
  text,
  text,
  text,
  time,
  time,
  integer,
  text,
  integer,
  text,
  text,
  boolean,
  uuid,
  integer,
  text
) to authenticated;

grant execute on function public.activate_pilot_nfc_tag(text)
to authenticated;

comment on function public.save_onboarding(
  text,
  text,
  text,
  time,
  time,
  integer,
  text,
  integer,
  text,
  text,
  boolean,
  uuid,
  integer,
  text
) is
  'Atomically saves authenticated onboarding and optionally creates or claims the owner-scoped pilot NFC tag.';

comment on function public.activate_pilot_nfc_tag(text) is
  'Idempotently creates or claims the authenticated user''s active pilot NFC tag for their active primary bottle.';

commit;

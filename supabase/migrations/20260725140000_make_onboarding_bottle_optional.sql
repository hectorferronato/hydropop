begin;

drop function if exists public.save_onboarding(
  text,
  text,
  text,
  time,
  time,
  integer,
  uuid,
  text,
  integer,
  text,
  text,
  boolean
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
  p_bottle_id uuid default null
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
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_display_name), '') is null then
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

  if nullif(btrim(p_bottle_name), '') is null then
    raise exception 'Bottle name is required'
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
    btrim(p_display_name),
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
    insert into public.bottles (
      user_id,
      name,
      brand,
      model,
      capacity_ml,
      is_primary
    )
    values (
      v_user_id,
      btrim(p_bottle_name),
      nullif(btrim(p_bottle_brand), ''),
      nullif(btrim(p_bottle_model), ''),
      p_bottle_capacity_ml,
      false
    )
    returning id into v_bottle_id;
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
      name = btrim(p_bottle_name),
      brand = nullif(btrim(p_bottle_brand), ''),
      model = nullif(btrim(p_bottle_model), ''),
      capacity_ml = p_bottle_capacity_ml
    where id = v_bottle_id
      and user_id = v_user_id;
  end if;

  if p_bottle_is_primary then
    update public.bottles
    set is_primary = false
    where user_id = v_user_id
      and id <> v_bottle_id
      and is_primary
      and archived_at is null;
  end if;

  update public.bottles
  set is_primary = p_bottle_is_primary
  where id = v_bottle_id
    and user_id = v_user_id;

  select goals.*
  into v_current_goal
  from public.hydration_goals as goals
  where goals.user_id = v_user_id
    and goals.effective_from <= v_hydration_day
    and (
      goals.effective_until is null
      or goals.effective_until >= v_hydration_day
    )
  order by goals.effective_from desc
  limit 1
  for update;

  if v_current_goal.id is not null
    and v_current_goal.effective_from = v_hydration_day then
    update public.hydration_goals
    set
      daily_goal_ml = p_daily_goal_ml,
      target_completion_time = p_target_completion_time
    where id = v_current_goal.id
      and user_id = v_user_id;
  elsif v_current_goal.id is null
    or v_current_goal.daily_goal_ml is distinct from p_daily_goal_ml
    or v_current_goal.target_completion_time
      is distinct from p_target_completion_time then
    if v_current_goal.id is not null then
      update public.hydration_goals
      set effective_until = v_hydration_day - 1
      where id = v_current_goal.id
        and user_id = v_user_id;
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

  return v_bottle_id;
end;
$$;

revoke all on function public.save_onboarding(
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
  uuid
) from public, anon;

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
  uuid
) to authenticated;

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
  uuid
) is
  'Atomically saves the authenticated user profile, active goal, and owned bottle setup.';

commit;

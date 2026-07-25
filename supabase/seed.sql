-- Development-only seed data for an existing Auth user.
--
-- Supply exactly one PostgreSQL custom setting before executing this file:
--   hydropop.seed_user_id
--   hydropop.seed_user_email
--
-- The documented commands in README.md pass these settings without interpolating
-- them into SQL. If neither setting is present, the seed safely skips all work.

do $$
declare
  requested_user_id text :=
    nullif(current_setting('hydropop.seed_user_id', true), '');
  requested_user_email text :=
    nullif(current_setting('hydropop.seed_user_email', true), '');
  candidate_user_id uuid;
  seed_user_id uuid;
  seed_bottle_id uuid;
  seed_device_id uuid;
  seed_goal_id uuid;
  reversed_event_id uuid;
  seed_today date :=
    (statement_timestamp() at time zone 'America/New_York')::date;
  seed_day date;
  occurred_at_value timestamptz;
begin
  if requested_user_id is null and requested_user_email is null then
    raise notice
      'HydroPOP seed skipped: set hydropop.seed_user_id or hydropop.seed_user_email';
    return;
  end if;

  if requested_user_id is not null and requested_user_email is not null then
    raise exception
      'Set only one of hydropop.seed_user_id or hydropop.seed_user_email';
  end if;

  if requested_user_id is not null then
    begin
      candidate_user_id := requested_user_id::uuid;
    exception
      when invalid_text_representation then
        raise exception 'hydropop.seed_user_id must be a valid UUID';
    end;

    select users.id
    into seed_user_id
    from auth.users as users
    where users.id = candidate_user_id;
  else
    select users.id
    into seed_user_id
    from auth.users as users
    where lower(users.email) = lower(requested_user_email);
  end if;

  if seed_user_id is null then
    raise exception 'No Auth user matches the supplied seed identifier';
  end if;

  insert into public.profiles (
    id,
    display_name,
    timezone,
    preferred_unit,
    wake_time,
    target_completion_time
  )
  values (
    seed_user_id,
    'Bea',
    'America/New_York',
    'oz',
    time '07:00',
    time '20:00'
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    timezone = excluded.timezone,
    preferred_unit = excluded.preferred_unit,
    wake_time = excluded.wake_time,
    target_completion_time = excluded.target_completion_time;

  select bottles.id
  into seed_bottle_id
  from public.bottles
  where bottles.user_id = seed_user_id
    and bottles.name = 'Owala 24 oz'
    and bottles.archived_at is null
  order by bottles.created_at
  limit 1;

  update public.bottles
  set is_primary = false
  where user_id = seed_user_id
    and is_primary
    and archived_at is null
    and (seed_bottle_id is null or id <> seed_bottle_id);

  if seed_bottle_id is null then
    insert into public.bottles (
      user_id,
      name,
      brand,
      capacity_ml,
      is_primary
    )
    values (
      seed_user_id,
      'Owala 24 oz',
      'Owala',
      710,
      true
    )
    returning id into seed_bottle_id;
  else
    update public.bottles
    set
      brand = 'Owala',
      capacity_ml = 710,
      is_primary = true,
      archived_at = null
    where id = seed_bottle_id;
  end if;

  select hydration_goals.id
  into seed_goal_id
  from public.hydration_goals
  where hydration_goals.user_id = seed_user_id
    and hydration_goals.effective_until is null
  order by hydration_goals.effective_from desc
  limit 1;

  if seed_goal_id is null then
    insert into public.hydration_goals (
      user_id,
      daily_goal_ml,
      effective_from,
      target_completion_time
    )
    values (
      seed_user_id,
      2130,
      seed_today - 28,
      time '20:00'
    )
    returning id into seed_goal_id;
  else
    update public.hydration_goals
    set
      daily_goal_ml = 2130,
      target_completion_time = time '20:00'
    where id = seed_goal_id;
  end if;

  select devices.id
  into seed_device_id
  from public.devices
  where devices.user_id = seed_user_id
    and devices.device_type = 'simulated_charm'
    and devices.name = 'Simulated HydroPOP Charm'
  order by devices.created_at
  limit 1;

  if seed_device_id is null then
    insert into public.devices (
      user_id,
      bottle_id,
      name,
      device_type,
      status,
      battery_percent
    )
    values (
      seed_user_id,
      seed_bottle_id,
      'Simulated HydroPOP Charm',
      'simulated_charm',
      'active',
      86
    )
    returning id into seed_device_id;
  else
    update public.devices
    set
      bottle_id = seed_bottle_id,
      status = 'active',
      battery_percent = 86
    where id = seed_device_id;
  end if;

  for seed_day in
    select generated_day::date
    from generate_series(
      seed_today - 28,
      seed_today - 1,
      interval '1 day'
    ) as generated_day
  loop
    occurred_at_value :=
      (
        seed_day
        + time '07:10'
        + ((extract(isodow from seed_day)::integer % 3) * interval '8 minutes')
      ) at time zone 'America/New_York';

    insert into public.hydration_events (
      user_id,
      bottle_id,
      device_id,
      source,
      event_type,
      volume_ml,
      occurred_at,
      received_at,
      idempotency_key,
      metadata
    )
    values (
      seed_user_id,
      seed_bottle_id,
      seed_device_id,
      'simulator',
      'fill_started',
      0,
      occurred_at_value,
      occurred_at_value + interval '20 seconds',
      format('seed-bea-%s-fill', to_char(seed_day, 'YYYY-MM-DD')),
      jsonb_build_object('seed', true, 'cycle', 1)
    )
    on conflict (user_id, idempotency_key) do nothing;

    occurred_at_value :=
      (seed_day + time '10:25') at time zone 'America/New_York';

    insert into public.hydration_events (
      user_id,
      bottle_id,
      device_id,
      source,
      event_type,
      volume_ml,
      occurred_at,
      received_at,
      idempotency_key,
      metadata
    )
    values (
      seed_user_id,
      seed_bottle_id,
      seed_device_id,
      'simulator',
      'refill',
      710,
      occurred_at_value,
      occurred_at_value + interval '35 seconds',
      format('seed-bea-%s-refill-1', to_char(seed_day, 'YYYY-MM-DD')),
      jsonb_build_object('seed', true, 'credited_cycle', 1, 'starts_cycle', 2)
    )
    on conflict (user_id, idempotency_key) do nothing;

    occurred_at_value :=
      (
        seed_day
        + time '13:45'
        + ((extract(isodow from seed_day)::integer % 2) * interval '12 minutes')
      ) at time zone 'America/New_York';

    insert into public.hydration_events (
      user_id,
      bottle_id,
      device_id,
      source,
      event_type,
      volume_ml,
      occurred_at,
      received_at,
      idempotency_key,
      metadata
    )
    values (
      seed_user_id,
      seed_bottle_id,
      seed_device_id,
      'simulator',
      'refill',
      710,
      occurred_at_value,
      occurred_at_value + interval '28 seconds',
      format('seed-bea-%s-refill-2', to_char(seed_day, 'YYYY-MM-DD')),
      jsonb_build_object('seed', true, 'credited_cycle', 2, 'starts_cycle', 3)
    )
    on conflict (user_id, idempotency_key) do nothing;

    if extract(isodow from seed_day)::integer not in (2, 6) then
      occurred_at_value :=
        (
          seed_day
          + time '18:20'
          + ((extract(isodow from seed_day)::integer % 3) * interval '10 minutes')
        ) at time zone 'America/New_York';

      insert into public.hydration_events (
        user_id,
        bottle_id,
        device_id,
        source,
        event_type,
        volume_ml,
        occurred_at,
        received_at,
        idempotency_key,
        metadata
      )
      values (
        seed_user_id,
        seed_bottle_id,
        seed_device_id,
        'simulator',
        'bottle_finished',
        710,
        occurred_at_value,
        occurred_at_value + interval '42 seconds',
        format('seed-bea-%s-finished', to_char(seed_day, 'YYYY-MM-DD')),
        jsonb_build_object('seed', true, 'credited_cycle', 3)
      )
      on conflict (user_id, idempotency_key) do nothing;
    end if;
  end loop;

  occurred_at_value :=
    (seed_today - 12 + time '19:05') at time zone 'America/New_York';

  insert into public.hydration_events (
    user_id,
    bottle_id,
    device_id,
    source,
    event_type,
    volume_ml,
    occurred_at,
    received_at,
    idempotency_key,
    metadata
  )
  values (
    seed_user_id,
    seed_bottle_id,
    seed_device_id,
    'admin',
    'adjustment',
    -120,
    occurred_at_value,
    occurred_at_value + interval '1 minute',
    format(
      'seed-bea-%s-adjustment',
      to_char(seed_today - 12, 'YYYY-MM-DD')
    ),
    jsonb_build_object(
      'seed',
      true,
      'reason',
      'Corrected an over-counted device calibration event'
    )
  )
  on conflict (user_id, idempotency_key) do nothing;

  select hydration_events.id
  into reversed_event_id
  from public.hydration_events
  where hydration_events.user_id = seed_user_id
    and hydration_events.idempotency_key = format(
      'seed-bea-%s-refill-2',
      to_char(seed_today - 20, 'YYYY-MM-DD')
    );

  if reversed_event_id is not null then
    occurred_at_value :=
      (seed_today - 20 + time '14:15') at time zone 'America/New_York';

    insert into public.hydration_events (
      user_id,
      bottle_id,
      device_id,
      source,
      event_type,
      occurred_at,
      received_at,
      idempotency_key,
      reverses_event_id,
      metadata
    )
    values (
      seed_user_id,
      seed_bottle_id,
      seed_device_id,
      'admin',
      'event_reversed',
      occurred_at_value,
      occurred_at_value + interval '1 minute',
      format(
        'seed-bea-%s-reversal',
        to_char(seed_today - 20, 'YYYY-MM-DD')
      ),
      reversed_event_id,
      jsonb_build_object(
        'seed',
        true,
        'reason',
        'Duplicate refill detected during reconciliation'
      )
    )
    on conflict (user_id, idempotency_key) do nothing;
  end if;
end;
$$;

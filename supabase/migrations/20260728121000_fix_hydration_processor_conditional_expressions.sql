begin;

create or replace function public.process_hydration_event(
  p_bottle_id uuid,
  p_event_type text,
  p_occurred_at timestamptz,
  p_idempotency_key text,
  p_source text,
  p_volume_ml integer default null,
  p_device_id uuid default null,
  p_reverses_event_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_bottle public.bottles%rowtype;
  v_event public.hydration_events%rowtype;
  v_original public.hydration_events%rowtype;
  v_last_cycle_type text;
  v_hydration_day date;
  v_is_active_cycle boolean := false;
  v_effective_event_type text := p_event_type;
  v_effective_volume_ml integer := p_volume_ml;
  v_metadata jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'UNAUTHENTICATED'
    );
  end if;

  if p_idempotency_key is null
    or pg_catalog.btrim(p_idempotency_key) = ''
    or pg_catalog.length(p_idempotency_key) > 200 then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'INVALID_INPUT'
    );
  end if;

  -- Serialize retries for a user-scoped idempotency key before checking it.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':hydration-idempotency:' || p_idempotency_key,
      0
    )
  );

  select hydration_events.*
  into v_event
  from public.hydration_events
  where hydration_events.user_id = v_user_id
    and hydration_events.idempotency_key = p_idempotency_key;

  if found then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'event', pg_catalog.to_jsonb(v_event)
    );
  end if;

  if p_occurred_at > pg_catalog.statement_timestamp() + interval '5 minutes' then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'EVENT_IN_FUTURE'
    );
  end if;

  if p_occurred_at < pg_catalog.statement_timestamp() - interval '7 days' then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'EVENT_TOO_OLD'
    );
  end if;

  if p_event_type not in (
    'fill_started',
    'refill',
    'bottle_finished',
    'manual_intake',
    'adjustment',
    'event_reversed'
  ) or p_source not in (
    'nfc',
    'web',
    'simulator',
    'mobile',
    'charm',
    'admin'
  ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'INVALID_INPUT'
    );
  end if;

  select bottles.*
  into v_bottle
  from public.bottles
  where bottles.id = p_bottle_id
    and bottles.user_id = v_user_id;

  if not found then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'BOTTLE_NOT_FOUND'
    );
  end if;

  -- State reconstruction must happen after this lock. Concurrent refill
  -- requests therefore cannot both observe and credit the same logical cycle:
  -- the second request observes the new cycle created by the first refill.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':hydration-bottle:' || p_bottle_id::text,
      0
    )
  );

  if p_device_id is not null and not exists (
    select 1
    from public.devices
    where devices.id = p_device_id
      and devices.user_id = v_user_id
      and (devices.bottle_id is null or devices.bottle_id = p_bottle_id)
  ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'DEVICE_NOT_FOUND'
    );
  end if;

  if p_event_type = 'event_reversed' then
    if p_reverses_event_id is null or p_volume_ml is not null then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'error_code', 'INVALID_REVERSAL'
      );
    end if;

    select hydration_events.*
    into v_original
    from public.hydration_events
    where hydration_events.id = p_reverses_event_id
      and hydration_events.user_id = v_user_id;

    if not found
      or v_original.event_type = 'event_reversed'
      or v_original.bottle_id <> p_bottle_id then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'error_code', 'INVALID_REVERSAL'
      );
    end if;

    if exists (
      select 1
      from public.hydration_events
      where hydration_events.user_id = v_user_id
        and hydration_events.reverses_event_id = v_original.id
        and hydration_events.event_type = 'event_reversed'
    ) then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'error_code', 'EVENT_ALREADY_REVERSED'
      );
    end if;

    v_effective_volume_ml := null;
    v_metadata := pg_catalog.jsonb_build_object(
      'reversed_event_type', v_original.event_type,
      'reversed_volume_ml', v_original.volume_ml
    );
  else
    if v_bottle.archived_at is not null or not v_bottle.is_primary then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'error_code', 'NO_PRIMARY_BOTTLE'
      );
    end if;

    select (p_occurred_at at time zone profiles.timezone)::date
    into v_hydration_day
    from public.profiles
    where profiles.id = v_user_id;

    if v_hydration_day is null or not exists (
      select 1
      from public.hydration_goals
      where hydration_goals.user_id = v_user_id
        and hydration_goals.effective_from <= v_hydration_day
        and (
          hydration_goals.effective_until is null
          or hydration_goals.effective_until >= v_hydration_day
        )
    ) then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'error_code', 'NO_ACTIVE_GOAL'
      );
    end if;

    select hydration_events.event_type
    into v_last_cycle_type
    from public.hydration_events
    where hydration_events.user_id = v_user_id
      and hydration_events.bottle_id = p_bottle_id
      and hydration_events.occurred_at <= p_occurred_at
      and hydration_events.event_type in (
        'fill_started',
        'refill',
        'bottle_finished'
      )
      and not exists (
        select 1
        from public.hydration_events as reversals
        where reversals.user_id = v_user_id
          and reversals.event_type = 'event_reversed'
          and reversals.reverses_event_id = hydration_events.id
      )
    order by
      hydration_events.occurred_at desc,
      hydration_events.received_at desc,
      hydration_events.id desc
    limit 1;

    v_is_active_cycle := coalesce(
      v_last_cycle_type in ('fill_started', 'refill'),
      false
    );

    if p_event_type = 'fill_started' then
      if v_is_active_cycle
        or (p_volume_ml is not null and p_volume_ml <> 0)
        or p_reverses_event_id is not null then
        return pg_catalog.jsonb_build_object(
          'ok', false,
          'error_code', 'INVALID_INPUT'
        );
      end if;

      v_effective_volume_ml := 0;
    elsif p_event_type = 'refill' then
      if p_volume_ml is not null or p_reverses_event_id is not null then
        return pg_catalog.jsonb_build_object(
          'ok', false,
          'error_code', 'INVALID_INPUT'
        );
      end if;

      if not v_is_active_cycle then
        v_effective_event_type := 'fill_started';
        v_effective_volume_ml := 0;
      else
        v_effective_volume_ml := v_bottle.capacity_ml;
      end if;
    elsif p_event_type = 'bottle_finished' then
      if not v_is_active_cycle then
        return pg_catalog.jsonb_build_object(
          'ok', false,
          'error_code', 'NO_ACTIVE_BOTTLE_CYCLE'
        );
      end if;

      if p_volume_ml is not null or p_reverses_event_id is not null then
        return pg_catalog.jsonb_build_object(
          'ok', false,
          'error_code', 'INVALID_INPUT'
        );
      end if;

      v_effective_volume_ml := v_bottle.capacity_ml;
    elsif p_event_type = 'manual_intake' then
      if p_volume_ml is null
        or p_volume_ml <= 0
        or p_reverses_event_id is not null then
        return pg_catalog.jsonb_build_object(
          'ok', false,
          'error_code', 'INVALID_INPUT'
        );
      end if;
    elsif p_event_type = 'adjustment' then
      if p_volume_ml is null
        or p_volume_ml = 0
        or p_reverses_event_id is not null then
        return pg_catalog.jsonb_build_object(
          'ok', false,
          'error_code', 'INVALID_INPUT'
        );
      end if;
    end if;

    v_metadata := pg_catalog.jsonb_build_object(
      'bottle_capacity_ml', v_bottle.capacity_ml,
      'requested_event_type', p_event_type
    );
  end if;

  insert into public.hydration_events (
    user_id,
    bottle_id,
    device_id,
    source,
    event_type,
    volume_ml,
    occurred_at,
    idempotency_key,
    reverses_event_id,
    metadata
  )
  values (
    v_user_id,
    p_bottle_id,
    p_device_id,
    p_source,
    v_effective_event_type,
    v_effective_volume_ml,
    p_occurred_at,
    p_idempotency_key,
    p_reverses_event_id,
    v_metadata
  )
  returning * into v_event;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'event', pg_catalog.to_jsonb(v_event)
  );
end;
$$;

revoke execute on function public.process_hydration_event(
  uuid,
  text,
  timestamptz,
  text,
  text,
  integer,
  uuid,
  uuid
) from public, anon;

grant execute on function public.process_hydration_event(
  uuid,
  text,
  timestamptz,
  text,
  text,
  integer,
  uuid,
  uuid
) to authenticated;

comment on function public.process_hydration_event(
  uuid,
  text,
  timestamptz,
  text,
  text,
  integer,
  uuid,
  uuid
) is
  'Atomically validates and inserts one immutable hydration event for auth.uid(). Duplicate idempotency keys return the original event.';

commit;

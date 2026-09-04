begin;

alter table public.devices
add column credential_hash text;

alter table public.devices
add column revoked_at timestamptz;

alter table public.devices
drop constraint devices_device_type_check;

alter table public.devices
add constraint devices_device_type_check
check (
  device_type in (
    'nfc_tag',
    'simulated_charm',
    'hydropop_charm',
    'physical_button'
  )
);

alter table public.devices
add constraint devices_credential_hash_check
check (
  credential_hash is null
  or credential_hash ~ '^[0-9a-f]{64}$'
);

alter table public.devices
add constraint devices_physical_button_credential_check
check (
  (
    device_type = 'physical_button'
    and bottle_id is not null
    and credential_hash is not null
    and (
      (status = 'active' and revoked_at is null)
      or (status = 'retired' and revoked_at is not null)
    )
  )
  or (
    device_type <> 'physical_button'
    and credential_hash is null
    and revoked_at is null
  )
);

create unique index devices_credential_hash_idx
on public.devices (credential_hash)
where credential_hash is not null;

comment on column public.devices.credential_hash is
  'Lowercase hexadecimal SHA-256 digest of a physical-device credential. Raw credentials must never be stored or logged.';

comment on column public.devices.revoked_at is
  'Credential revocation time for physical HydroPOP buttons.';

-- Existing non-secret device columns remain available to authenticated owners.
-- The credential digest is deliberately excluded from every direct SELECT grant.
revoke select, insert, update on table public.devices from authenticated;

grant select (
  id,
  user_id,
  bottle_id,
  name,
  device_type,
  status,
  firmware_version,
  battery_percent,
  last_seen_at,
  last_synced_at,
  created_at,
  updated_at,
  revoked_at
) on public.devices to authenticated;

grant insert (
  user_id,
  bottle_id,
  name,
  device_type,
  status,
  firmware_version,
  battery_percent,
  last_seen_at,
  last_synced_at
) on public.devices to authenticated;

grant update (
  bottle_id,
  name,
  device_type,
  status,
  firmware_version,
  battery_percent,
  last_seen_at,
  last_synced_at
) on public.devices to authenticated;

create function public.protect_physical_button_device_credentials()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
    and (
      new.device_type = 'physical_button'
      or (tg_op = 'UPDATE' and old.device_type = 'physical_button')
    )
  then
    raise exception 'Physical buttons must be managed through their narrow device RPCs'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger devices_protect_physical_button_credentials
before insert or update on public.devices
for each row execute function public.protect_physical_button_device_credentials();

revoke execute on function public.protect_physical_button_device_credentials()
from public, anon, authenticated;

alter table public.hydration_events
drop constraint hydration_events_source_check;

alter table public.hydration_events
add constraint hydration_events_source_check
check (
  source in (
    'nfc',
    'web',
    'simulator',
    'mobile',
    'charm',
    'device',
    'admin'
  )
);

drop policy hydration_events_insert_own on public.hydration_events;

create policy hydration_events_insert_own
on public.hydration_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and source <> 'device'
  and exists (
    select 1
    from public.bottles
    where bottles.id = hydration_events.bottle_id
      and bottles.user_id = (select auth.uid())
  )
  and (
    device_id is null
    or exists (
      select 1
      from public.devices
      where devices.id = hydration_events.device_id
        and devices.user_id = (select auth.uid())
    )
  )
);

-- This remains the single authoritative hydration processor. The only changes
-- are the trusted device source and allowing that source to use its assigned
-- owned active bottle even when the bottle is not the account primary.
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
  v_hydration_day date;
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
    'bottle_completed',
    'manual_intake',
    'adjustment',
    'event_reversed'
  ) or p_source not in (
    'nfc',
    'web',
    'simulator',
    'mobile',
    'charm',
    'device',
    'admin'
  ) or (p_source = 'device' and current_user = 'authenticated') then
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

  if p_source = 'device' and (
    p_device_id is null
    or not exists (
      select 1
      from public.devices
      where devices.id = p_device_id
        and devices.user_id = v_user_id
        and devices.bottle_id = p_bottle_id
        and devices.device_type = 'physical_button'
        and devices.status = 'active'
        and devices.revoked_at is null
    )
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
    if v_bottle.archived_at is not null
      or (p_source <> 'device' and not v_bottle.is_primary) then
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

    if p_event_type = 'bottle_completed' then
      if p_volume_ml is not null or p_reverses_event_id is not null then
        return pg_catalog.jsonb_build_object(
          'ok', false,
          'error_code', 'INVALID_INPUT'
        );
      end if;

      v_effective_volume_ml := coalesce(
        v_bottle.typical_fill_ml,
        v_bottle.capacity_ml
      );
      v_metadata := pg_catalog.jsonb_build_object(
        'bottle_capacity_ml', v_bottle.capacity_ml,
        'typical_fill_ml', v_bottle.typical_fill_ml,
        'effective_credited_ml', v_effective_volume_ml,
        'requested_event_type', p_event_type
      );
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

    if p_event_type <> 'bottle_completed' then
      v_metadata := pg_catalog.jsonb_build_object(
        'bottle_capacity_ml', v_bottle.capacity_ml,
        'typical_fill_ml', v_bottle.typical_fill_ml,
        'requested_event_type', p_event_type
      );
    end if;
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
    p_event_type,
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

create function public.physical_button_safe_metadata(p_device public.devices)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', p_device.id,
    'label', p_device.name,
    'bottleId', p_device.bottle_id,
    'status', case
      when p_device.status = 'active' and p_device.revoked_at is null
        then 'active'
      else 'revoked'
    end,
    'createdAt', p_device.created_at,
    'revokedAt', p_device.revoked_at,
    'lastSeenAt', p_device.last_seen_at,
    'lastSuccessfulSyncAt', p_device.last_synced_at
  );
$$;

revoke execute on function public.physical_button_safe_metadata(public.devices)
from public, anon, authenticated;

create function public.list_physical_button_devices()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_devices jsonb;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      public.physical_button_safe_metadata(devices)
      order by devices.created_at desc, devices.id
    ),
    '[]'::jsonb
  )
  into v_devices
  from public.devices
  where devices.user_id = v_user_id
    and devices.device_type = 'physical_button';

  return pg_catalog.jsonb_build_object('devices', v_devices);
end;
$$;

create function public.create_physical_button_device(
  p_bottle_id uuid,
  p_label text,
  p_credential_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_device public.devices%rowtype;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if p_label is null
    or pg_catalog.char_length(pg_catalog.btrim(p_label)) not between 1 and 80
    or p_credential_hash is null
    or p_credential_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.bottles
    where bottles.id = p_bottle_id
      and bottles.user_id = v_user_id
      and bottles.archived_at is null
  ) then
    raise exception 'BOTTLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.devices (
    user_id,
    bottle_id,
    name,
    device_type,
    status,
    credential_hash
  )
  values (
    v_user_id,
    p_bottle_id,
    pg_catalog.btrim(p_label),
    'physical_button',
    'active',
    p_credential_hash
  )
  returning * into v_device;

  return public.physical_button_safe_metadata(v_device);
end;
$$;

create function public.update_physical_button_device(
  p_device_id uuid,
  p_bottle_id uuid,
  p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_device public.devices%rowtype;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if p_label is null
    or pg_catalog.char_length(pg_catalog.btrim(p_label)) not between 1 and 80 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.bottles
    where bottles.id = p_bottle_id
      and bottles.user_id = v_user_id
      and bottles.archived_at is null
  ) then
    raise exception 'BOTTLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.devices
  set
    bottle_id = p_bottle_id,
    name = pg_catalog.btrim(p_label)
  where devices.id = p_device_id
    and devices.user_id = v_user_id
    and devices.device_type = 'physical_button'
    and devices.status = 'active'
    and devices.revoked_at is null
  returning * into v_device;

  if not found then
    raise exception 'DEVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return public.physical_button_safe_metadata(v_device);
end;
$$;

create function public.revoke_physical_button_device(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_device public.devices%rowtype;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  update public.devices
  set
    status = 'retired',
    revoked_at = coalesce(revoked_at, pg_catalog.statement_timestamp())
  where devices.id = p_device_id
    and devices.user_id = v_user_id
    and devices.device_type = 'physical_button'
  returning * into v_device;

  if not found then
    raise exception 'DEVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return public.physical_button_safe_metadata(v_device);
end;
$$;

revoke execute on function public.list_physical_button_devices()
from public, anon, authenticated;
revoke execute on function public.create_physical_button_device(uuid, text, text)
from public, anon, authenticated;
revoke execute on function public.update_physical_button_device(uuid, uuid, text)
from public, anon, authenticated;
revoke execute on function public.revoke_physical_button_device(uuid)
from public, anon, authenticated;

grant execute on function public.list_physical_button_devices()
to authenticated;
grant execute on function public.create_physical_button_device(uuid, text, text)
to authenticated;
grant execute on function public.update_physical_button_device(uuid, uuid, text)
to authenticated;
grant execute on function public.revoke_physical_button_device(uuid)
to authenticated;

create function public.physical_button_status_state(
  p_user_id uuid,
  p_device_id uuid,
  p_now timestamptz
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_bottle public.bottles%rowtype;
  v_local_date date;
  v_goal public.hydration_goals%rowtype;
  v_today_ml bigint;
begin
  select profiles.*
  into v_profile
  from public.profiles
  where profiles.id = p_user_id;

  select bottles.*
  into v_bottle
  from public.devices
  inner join public.bottles
    on bottles.id = devices.bottle_id
    and bottles.user_id = devices.user_id
  where devices.id = p_device_id
    and devices.user_id = p_user_id
    and devices.device_type = 'physical_button'
    and devices.status = 'active'
    and devices.revoked_at is null
    and bottles.archived_at is null;

  if v_profile.id is null or v_bottle.id is null then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'DEVICE_CONFIGURATION_ERROR'
    );
  end if;

  v_local_date := (p_now at time zone v_profile.timezone)::date;

  select hydration_goals.*
  into v_goal
  from public.hydration_goals
  where hydration_goals.user_id = p_user_id
    and hydration_goals.effective_from <= v_local_date
    and (
      hydration_goals.effective_until is null
      or hydration_goals.effective_until >= v_local_date
    )
  order by hydration_goals.effective_from desc, hydration_goals.created_at desc
  limit 1;

  select greatest(
    0,
    coalesce(pg_catalog.sum(hydration_events.volume_ml), 0)
  )::bigint
  into v_today_ml
  from public.hydration_events
  where hydration_events.user_id = p_user_id
    and (
      hydration_events.occurred_at at time zone v_profile.timezone
    )::date = v_local_date
    and hydration_events.event_type <> 'event_reversed'
    and not exists (
      select 1
      from public.hydration_events as reversals
      where reversals.user_id = p_user_id
        and reversals.event_type = 'event_reversed'
        and reversals.reverses_event_id = hydration_events.id
    );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'serverTime', p_now,
    'localDate', v_local_date,
    'unit', v_profile.preferred_unit,
    'timezone', v_profile.timezone,
    'wakeTime', v_profile.wake_time,
    'targetCompletionTime', coalesce(
      v_goal.target_completion_time,
      v_profile.target_completion_time
    ),
    'todayMl', v_today_ml,
    'goalMl', v_goal.daily_goal_ml,
    'normalCompletionMl', coalesce(
      v_bottle.typical_fill_ml,
      v_bottle.capacity_ml
    )
  );
end;
$$;

revoke execute on function public.physical_button_status_state(uuid, uuid, timestamptz)
from public, anon, authenticated;

create function public.physical_button_api_is_authorized(p_api_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_api_secret is not null
    and p_api_secret ~ '^[0-9a-fA-F]{64}$'
    and exists (
      select 1
      from vault.decrypted_secrets
      where decrypted_secrets.name = 'hydropop_physical_device_rpc_secret'
        and decrypted_secrets.decrypted_secret = p_api_secret
    );
$$;

revoke execute on function public.physical_button_api_is_authorized(text)
from public, anon, authenticated;

create function public.get_physical_button_status(
  p_api_secret text,
  p_credential_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_device public.devices%rowtype;
begin
  if not public.physical_button_api_is_authorized(p_api_secret)
    or p_credential_hash is null
    or p_credential_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'DEVICE_UNAUTHORIZED'
    );
  end if;

  select devices.*
  into v_device
  from public.devices
  where devices.credential_hash = p_credential_hash
    and devices.device_type = 'physical_button'
    and devices.status = 'active'
    and devices.revoked_at is null;

  if not found then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'DEVICE_UNAUTHORIZED'
    );
  end if;

  return public.physical_button_status_state(
    v_device.user_id,
    v_device.id,
    pg_catalog.statement_timestamp()
  );
end;
$$;

create function public.record_physical_button_hydration(
  p_api_secret text,
  p_credential_hash text,
  p_idempotency_key text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices%rowtype;
  v_scoped_idempotency_key text;
  v_result jsonb;
  v_event jsonb;
  v_state jsonb;
begin
  if not public.physical_button_api_is_authorized(p_api_secret)
    or p_credential_hash is null
    or p_credential_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'DEVICE_UNAUTHORIZED'
    );
  end if;

  select devices.*
  into v_device
  from public.devices
  where devices.credential_hash = p_credential_hash
    and devices.device_type = 'physical_button'
    and devices.status = 'active'
    and devices.revoked_at is null
  for share;

  if not found then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'DEVICE_UNAUTHORIZED'
    );
  end if;

  if p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or p_occurred_at is null then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'INVALID_INPUT'
    );
  end if;

  if not exists (
    select 1
    from public.bottles
    where bottles.id = v_device.bottle_id
      and bottles.user_id = v_device.user_id
      and bottles.archived_at is null
  ) then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error_code', 'DEVICE_CONFIGURATION_ERROR'
    );
  end if;

  v_scoped_idempotency_key := 'physical-device:'
    || v_device.id::text || ':' || p_idempotency_key;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_device.user_id::text,
    true
  );

  v_result := public.process_hydration_event(
    v_device.bottle_id,
    'bottle_completed',
    p_occurred_at,
    v_scoped_idempotency_key,
    'device',
    null,
    v_device.id,
    null
  );

  if not coalesce((v_result ->> 'ok')::boolean, false) then
    return v_result;
  end if;

  v_event := v_result -> 'event';

  if v_event ->> 'device_id' is distinct from v_device.id::text
    or v_event ->> 'event_type' is distinct from 'bottle_completed'
    or v_event ->> 'source' is distinct from 'device'
    or v_event ->> 'idempotency_key' is distinct from v_scoped_idempotency_key then
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
  end if;

  update public.devices
  set
    last_seen_at = pg_catalog.statement_timestamp(),
    last_synced_at = pg_catalog.statement_timestamp()
  where devices.id = v_device.id
    and devices.status = 'active'
    and devices.revoked_at is null;

  v_state := public.physical_button_status_state(
    v_device.user_id,
    v_device.id,
    pg_catalog.statement_timestamp()
  );

  if not coalesce((v_state ->> 'ok')::boolean, false) then
    return v_state;
  end if;

  return v_state || pg_catalog.jsonb_build_object(
    'result', case
      when (v_result ->> 'duplicate')::boolean then 'existing'
      else 'created'
    end,
    'recordedMl', (v_event ->> 'volume_ml')::integer
  );
end;
$$;

revoke execute on function public.get_physical_button_status(text, text)
from public, anon, authenticated;
revoke execute on function public.record_physical_button_hydration(text, text, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.get_physical_button_status(text, text)
to anon;
grant execute on function public.record_physical_button_hydration(text, text, text, timestamptz)
to anon;

comment on function public.get_physical_button_status(text, text) is
  'Authenticates the Next.js device boundary and a physical-button credential digest, then returns only approved hydration status inputs. It performs no writes.';

comment on function public.record_physical_button_hydration(text, text, text, timestamptz) is
  'Authenticates the Next.js device boundary and one physical button, then delegates exactly one bottle_completed event to the authoritative hydration processor.';

commit;

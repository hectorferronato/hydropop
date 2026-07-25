begin;

create extension if not exists btree_gist with schema extensions;

create or replace function public.is_valid_timezone(timezone_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = timezone_name
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'America/New_York',
  preferred_unit text not null default 'oz',
  wake_time time,
  target_completion_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_timezone_check
    check (public.is_valid_timezone(timezone)),
  constraint profiles_preferred_unit_check
    check (preferred_unit in ('oz', 'ml'))
);

create table public.bottles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  brand text,
  model text,
  capacity_ml integer not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint bottles_name_check check (btrim(name) <> ''),
  constraint bottles_capacity_ml_check check (capacity_ml > 0),
  constraint bottles_id_user_id_key unique (id, user_id)
);

create unique index bottles_one_active_primary_per_user_idx
  on public.bottles (user_id)
  where is_primary and archived_at is null;

create table public.hydration_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  daily_goal_ml integer not null,
  effective_from date not null,
  effective_until date,
  target_completion_time time,
  created_at timestamptz not null default now(),
  constraint hydration_goals_daily_goal_ml_check
    check (daily_goal_ml > 0),
  constraint hydration_goals_effective_dates_check
    check (
      effective_until is null
      or effective_until >= effective_from
    ),
  constraint hydration_goals_user_effective_from_key
    unique (user_id, effective_from),
  constraint hydration_goals_no_overlapping_periods
    exclude using gist (
      user_id with =,
      daterange(effective_from, effective_until, '[]') with &&
    )
);

create table public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bottle_id uuid not null,
  token_hash text not null unique,
  label text,
  status text not null default 'active',
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint nfc_tags_bottle_owner_fk
    foreign key (bottle_id, user_id)
    references public.bottles (id, user_id),
  constraint nfc_tags_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint nfc_tags_status_check
    check (status in ('active', 'disabled', 'revoked'))
);

comment on column public.nfc_tags.token_hash is
  'Lowercase hexadecimal SHA-256 token digest. Raw public NFC tokens must never be stored.';

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bottle_id uuid,
  name text not null,
  device_type text not null,
  status text not null default 'active',
  firmware_version text,
  battery_percent integer,
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_bottle_owner_fk
    foreign key (bottle_id, user_id)
    references public.bottles (id, user_id),
  constraint devices_name_check check (btrim(name) <> ''),
  constraint devices_device_type_check
    check (
      device_type in (
        'nfc_tag',
        'simulated_charm',
        'hydropop_charm'
      )
    ),
  constraint devices_status_check
    check (status in ('active', 'inactive', 'offline', 'retired')),
  constraint devices_battery_percent_check
    check (
      battery_percent is null
      or battery_percent between 0 and 100
    ),
  constraint devices_id_user_id_key unique (id, user_id)
);

create table public.hydration_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bottle_id uuid not null,
  device_id uuid,
  source text not null,
  event_type text not null,
  volume_ml integer,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  idempotency_key text not null,
  reverses_event_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint hydration_events_bottle_owner_fk
    foreign key (bottle_id, user_id)
    references public.bottles (id, user_id),
  constraint hydration_events_device_owner_fk
    foreign key (device_id, user_id)
    references public.devices (id, user_id),
  constraint hydration_events_reversed_event_owner_fk
    foreign key (reverses_event_id, user_id)
    references public.hydration_events (id, user_id),
  constraint hydration_events_source_check
    check (
      source in (
        'nfc',
        'web',
        'simulator',
        'mobile',
        'charm',
        'admin'
      )
    ),
  constraint hydration_events_event_type_check
    check (
      event_type in (
        'fill_started',
        'refill',
        'bottle_finished',
        'manual_intake',
        'adjustment',
        'event_reversed'
      )
    ),
  constraint hydration_events_volume_matches_type_check
    check (
      (event_type = 'fill_started' and coalesce(volume_ml, 0) = 0)
      or (
        event_type in ('refill', 'bottle_finished', 'manual_intake')
        and volume_ml > 0
      )
      or (event_type = 'adjustment' and volume_ml <> 0)
      or (event_type = 'event_reversed' and volume_ml is null)
    ),
  constraint hydration_events_reversal_matches_type_check
    check (
      (
        event_type = 'event_reversed'
        and reverses_event_id is not null
      )
      or (
        event_type <> 'event_reversed'
        and reverses_event_id is null
      )
    ),
  constraint hydration_events_cannot_reverse_self_check
    check (reverses_event_id is null or reverses_event_id <> id),
  constraint hydration_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint hydration_events_idempotency_key_check
    check (btrim(idempotency_key) <> ''),
  constraint hydration_events_user_idempotency_key
    unique (user_id, idempotency_key),
  constraint hydration_events_id_user_id_key
    unique (id, user_id)
);

create unique index hydration_events_one_reversal_per_event_idx
  on public.hydration_events (user_id, reverses_event_id)
  where event_type = 'event_reversed';

create index bottles_user_id_idx
  on public.bottles (user_id);

create index hydration_goals_user_effective_dates_idx
  on public.hydration_goals (user_id, effective_from desc, effective_until);

create index nfc_tags_user_id_idx
  on public.nfc_tags (user_id);

create index nfc_tags_bottle_id_idx
  on public.nfc_tags (bottle_id);

create index devices_user_id_idx
  on public.devices (user_id);

create index devices_bottle_id_idx
  on public.devices (bottle_id)
  where bottle_id is not null;

create index hydration_events_user_occurred_at_idx
  on public.hydration_events (user_id, occurred_at desc);

create index hydration_events_bottle_occurred_at_idx
  on public.hydration_events (bottle_id, occurred_at desc);

create index hydration_events_device_id_idx
  on public.hydration_events (device_id)
  where device_id is not null;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger bottles_set_updated_at
before update on public.bottles
for each row execute function public.set_updated_at();

create trigger devices_set_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public;
revoke all on function public.create_profile_for_auth_user() from anon;
revoke all on function public.create_profile_for_auth_user() from authenticated;

create trigger hydropop_create_profile_after_auth_user_insert
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

-- Backfill only the Auth user ID. Profile defaults provide the remaining values,
-- and ON CONFLICT makes this safe when a profile already exists.
insert into public.profiles (id)
select auth_user.id
from auth.users as auth_user
on conflict (id) do nothing;

create or replace function public.protect_historical_hydration_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hydration_day date;
begin
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  select (statement_timestamp() at time zone profiles.timezone)::date
  into hydration_day
  from public.profiles
  where profiles.id = old.user_id;

  if tg_op = 'DELETE' then
    if old.effective_from <= hydration_day then
      raise exception 'Current or historical hydration goals cannot be deleted'
        using errcode = '42501';
    end if;

    return old;
  end if;

  if new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Hydration goal ownership and creation time are immutable'
      using errcode = '42501';
  end if;

  if old.effective_from < hydration_day then
    if new.effective_from is distinct from old.effective_from
      or new.daily_goal_ml is distinct from old.daily_goal_ml
      or new.target_completion_time is distinct from old.target_completion_time then
      raise exception 'Historical hydration goal values are immutable'
        using errcode = '42501';
    end if;

    if old.effective_until is not null
      and old.effective_until < hydration_day
      and new.effective_until is distinct from old.effective_until then
      raise exception 'Historical hydration goal date ranges are immutable'
        using errcode = '42501';
    end if;

    if new.effective_until is not null
      and new.effective_until < hydration_day - 1 then
      raise exception 'A historical goal can only be closed from yesterday onward'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger hydration_goals_protect_history
before update or delete on public.hydration_goals
for each row execute function public.protect_historical_hydration_goal();

create or replace function public.prevent_authenticated_hydration_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    raise exception 'Hydration events are immutable; insert a correction event'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger hydration_events_prevent_authenticated_mutation
before update or delete on public.hydration_events
for each row execute function public.prevent_authenticated_hydration_event_mutation();

comment on table public.hydration_goals is
  'Date-effective hydration goals. Historical values are protected from authenticated-client rewrites.';

comment on table public.hydration_events is
  'Immutable hydration facts. Corrections are represented by adjustment or event_reversed rows.';

commit;

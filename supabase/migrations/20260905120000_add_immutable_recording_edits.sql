begin;

-- Explicit immutable lineage; the source/type on replacements remain the origin.
alter table public.hydration_events add column corrects_event_id uuid;
alter table public.hydration_events add constraint hydration_events_correction_owner_fk
  foreign key (corrects_event_id, user_id) references public.hydration_events (id, user_id);
alter table public.hydration_events add constraint hydration_events_correction_type_check
  check (corrects_event_id is null or (corrects_event_id <> id and event_type <> 'event_reversed'));
create unique index hydration_events_one_correction_per_event_idx
  on public.hydration_events (corrects_event_id) where corrects_event_id is not null;

-- Ordinary client inserts / existing invoker RPCs cannot forge lineage.
create function public.protect_hydration_correction_lineage()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.corrects_event_id is not null then
    raise exception 'Corrections require the owner recording operation' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_hydration_correction_lineage() from public, anon, authenticated;
create trigger hydration_events_protect_correction_lineage before insert on public.hydration_events
  for each row execute function public.protect_hydration_correction_lineage();

-- Narrow definer path is required to preserve device source and a corrected
-- bottle_completed snapshot. No source, type, owner, bottle or metadata inputs.
create function public.change_hydration_recording(
  p_event_id uuid, p_action text, p_idempotency_key uuid,
  p_volume_ml integer default null, p_occurred_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.hydration_events%rowtype;
  v_reversal public.hydration_events%rowtype;
  v_replacement public.hydration_events%rowtype;
  v_key text := 'recording:' || p_idempotency_key::text;
  v_day date;
begin
  if v_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  end if;
  if p_action is null or p_action not in ('edit', 'remove') or p_idempotency_key is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'INVALID_INPUT');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user_id::text || ':recording:' || p_idempotency_key::text, 0));
  select * into v_original from public.hydration_events
    where id = p_event_id and user_id = v_user_id;
  if not found or v_original.event_type = 'event_reversed' then
    return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN');
  end if;
  -- Same serialization boundary as the normal/NFC/device processor.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user_id::text || ':hydration-bottle:' || v_original.bottle_id::text, 0));
  perform 1 from public.hydration_events where id = p_event_id for update;

  select * into v_reversal from public.hydration_events
    where user_id = v_user_id and idempotency_key = v_key || ':reverse';
  if found then
    select * into v_replacement from public.hydration_events
      where user_id = v_user_id and idempotency_key = v_key || ':replacement';
    if v_reversal.reverses_event_id is distinct from p_event_id
      or (p_action = 'edit' and (v_replacement.id is null
        or v_replacement.volume_ml is distinct from p_volume_ml
        or v_replacement.occurred_at is distinct from p_occurred_at))
      or (p_action = 'remove' and (v_replacement.id is not null or p_volume_ml is not null or p_occurred_at is not null)) then
      return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'INVALID_INPUT');
    end if;
    return pg_catalog.jsonb_build_object('ok', true, 'duplicate', true,
      'event', case when p_action = 'edit' then pg_catalog.to_jsonb(v_replacement) else pg_catalog.to_jsonb(v_reversal) end);
  end if;
  if exists (select 1 from public.hydration_events where reverses_event_id = p_event_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'EVENT_ALREADY_REVERSED');
  end if;
  if p_action = 'edit' then
    if v_original.event_type not in ('bottle_completed', 'manual_intake', 'refill', 'bottle_finished', 'adjustment')
      or p_volume_ml is null or p_volume_ml <= 0 or p_volume_ml > 10000 or p_occurred_at is null
      or not pg_catalog.isfinite(p_occurred_at)
      or p_occurred_at < pg_catalog.statement_timestamp() - interval '10 years' then
      return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'INVALID_INPUT');
    end if;
    if p_occurred_at > pg_catalog.statement_timestamp() then
      return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'EVENT_IN_FUTURE');
    end if;
    select (p_occurred_at at time zone timezone)::date into v_day from public.profiles where id = v_user_id;
    if not exists (select 1 from public.hydration_goals where user_id = v_user_id
      and effective_from <= v_day and (effective_until is null or effective_until >= v_day)) then
      return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'NO_ACTIVE_GOAL');
    end if;
  elsif p_volume_ml is not null or p_occurred_at is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'error_code', 'INVALID_INPUT');
  end if;

  insert into public.hydration_events
    (user_id, bottle_id, source, event_type, volume_ml, occurred_at, idempotency_key, reverses_event_id)
  values (v_user_id, v_original.bottle_id, 'web', 'event_reversed', null,
    pg_catalog.statement_timestamp(), v_key || ':reverse', v_original.id)
  returning * into v_reversal;
  if p_action = 'edit' then
    insert into public.hydration_events
      (user_id, bottle_id, device_id, source, event_type, volume_ml, occurred_at, idempotency_key, corrects_event_id)
    values (v_user_id, v_original.bottle_id, v_original.device_id, v_original.source,
      v_original.event_type, p_volume_ml, p_occurred_at, v_key || ':replacement', v_original.id)
    returning * into v_replacement;
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'duplicate', false,
    'event', case when p_action = 'edit' then pg_catalog.to_jsonb(v_replacement) else pg_catalog.to_jsonb(v_reversal) end);
  -- Any insertion error aborts the entire RPC transaction, including reversal.
end;
$$;
revoke all on function public.change_hydration_recording(uuid, text, uuid, integer, timestamptz) from public, anon;
grant execute on function public.change_hydration_recording(uuid, text, uuid, integer, timestamptz) to authenticated;
comment on column public.hydration_events.corrects_event_id is 'Previous immutable version; only the owner correction RPC writes lineage. Source and semantic type retain original provenance.';
commit;

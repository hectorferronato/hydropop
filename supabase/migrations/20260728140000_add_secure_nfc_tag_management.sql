begin;

comment on column public.nfc_tags.last_scanned_at is
  'Timestamp of the latest successful confirmed NFC bottle completion. Read-only scans do not update it.';

create index nfc_tags_user_status_created_at_idx
  on public.nfc_tags (user_id, status, created_at desc);

create function public.create_nfc_tag(
  p_bottle_id uuid,
  p_token_hash text,
  p_label text default null
)
returns public.nfc_tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tag public.nfc_tags%rowtype;
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

  if p_label is not null and pg_catalog.length(pg_catalog.btrim(p_label)) > 80 then
    raise exception 'Tag labels must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.bottles
    where bottles.id = p_bottle_id
      and bottles.user_id = v_user_id
      and bottles.is_primary
      and bottles.archived_at is null
  ) then
    raise exception 'An active owned bottle is required'
      using errcode = '42501';
  end if;

  insert into public.nfc_tags (
    user_id,
    bottle_id,
    token_hash,
    label,
    status
  )
  values (
    v_user_id,
    p_bottle_id,
    p_token_hash,
    nullif(pg_catalog.btrim(p_label), ''),
    'active'
  )
  returning * into v_tag;

  return v_tag;
end;
$$;

create function public.rotate_nfc_tag(
  p_tag_id uuid,
  p_token_hash text
)
returns public.nfc_tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tag public.nfc_tags%rowtype;
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

  update public.nfc_tags
  set token_hash = p_token_hash
  where nfc_tags.id = p_tag_id
    and nfc_tags.user_id = v_user_id
    and nfc_tags.status = 'active'
  returning * into v_tag;

  if v_tag.id is null then
    raise exception 'NFC tag is unavailable'
      using errcode = 'P0002';
  end if;

  return v_tag;
end;
$$;

create function public.update_nfc_tag(
  p_tag_id uuid,
  p_bottle_id uuid,
  p_label text
)
returns public.nfc_tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tag public.nfc_tags%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if p_label is not null and pg_catalog.length(pg_catalog.btrim(p_label)) > 80 then
    raise exception 'Tag labels must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.bottles
    where bottles.id = p_bottle_id
      and bottles.user_id = v_user_id
      and bottles.is_primary
      and bottles.archived_at is null
  ) then
    raise exception 'An active owned bottle is required'
      using errcode = '42501';
  end if;

  update public.nfc_tags
  set
    bottle_id = p_bottle_id,
    label = nullif(pg_catalog.btrim(p_label), '')
  where nfc_tags.id = p_tag_id
    and nfc_tags.user_id = v_user_id
    and nfc_tags.status = 'active'
  returning * into v_tag;

  if v_tag.id is null then
    raise exception 'NFC tag is unavailable'
      using errcode = 'P0002';
  end if;

  return v_tag;
end;
$$;

create function public.revoke_nfc_tag(
  p_tag_id uuid
)
returns public.nfc_tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tag public.nfc_tags%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  update public.nfc_tags
  set status = 'revoked'
  where nfc_tags.id = p_tag_id
    and nfc_tags.user_id = v_user_id
    and nfc_tags.status = 'active'
  returning * into v_tag;

  if v_tag.id is null then
    raise exception 'NFC tag is unavailable'
      using errcode = 'P0002';
  end if;

  return v_tag;
end;
$$;

create function public.mark_nfc_tag_confirmed(
  p_tag_id uuid,
  p_event_id uuid
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_confirmed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select hydration_events.received_at
  into v_confirmed_at
  from public.hydration_events
  join public.nfc_tags
    on nfc_tags.id = p_tag_id
    and nfc_tags.user_id = v_user_id
    and nfc_tags.status = 'active'
    and nfc_tags.bottle_id = hydration_events.bottle_id
  where hydration_events.id = p_event_id
    and hydration_events.user_id = v_user_id
    and hydration_events.event_type = 'bottle_completed'
    and hydration_events.source = 'nfc';

  if v_confirmed_at is null then
    raise exception 'A confirmed NFC completion is required'
      using errcode = '42501';
  end if;

  update public.nfc_tags
  set last_scanned_at = case
    when nfc_tags.last_scanned_at is null then v_confirmed_at
    when nfc_tags.last_scanned_at < v_confirmed_at then v_confirmed_at
    else nfc_tags.last_scanned_at
  end
  where nfc_tags.id = p_tag_id
    and nfc_tags.user_id = v_user_id
    and nfc_tags.status = 'active'
  returning nfc_tags.last_scanned_at into v_confirmed_at;

  if v_confirmed_at is null then
    raise exception 'NFC tag is unavailable'
      using errcode = 'P0002';
  end if;

  return v_confirmed_at;
end;
$$;

revoke execute on function public.create_nfc_tag(uuid, text, text)
from public, anon;
revoke execute on function public.rotate_nfc_tag(uuid, text)
from public, anon;
revoke execute on function public.update_nfc_tag(uuid, uuid, text)
from public, anon;
revoke execute on function public.revoke_nfc_tag(uuid)
from public, anon;
revoke execute on function public.mark_nfc_tag_confirmed(uuid, uuid)
from public, anon;

grant execute on function public.create_nfc_tag(uuid, text, text)
to authenticated;
grant execute on function public.rotate_nfc_tag(uuid, text)
to authenticated;
grant execute on function public.update_nfc_tag(uuid, uuid, text)
to authenticated;
grant execute on function public.revoke_nfc_tag(uuid)
to authenticated;
grant execute on function public.mark_nfc_tag_confirmed(uuid, uuid)
to authenticated;

commit;

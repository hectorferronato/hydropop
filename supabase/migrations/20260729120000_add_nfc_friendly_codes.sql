begin;

alter table public.nfc_tags
add column friendly_code text;

alter table public.nfc_tags
add constraint nfc_tags_friendly_code_check
check (
  friendly_code is null
  or (
    friendly_code = lower(pg_catalog.btrim(friendly_code))
    and pg_catalog.char_length(friendly_code) between 3 and 32
    and friendly_code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and friendly_code not in (
      'admin',
      'api',
      'auth',
      'calendar',
      'community',
      'create',
      'device',
      'devices',
      'login',
      'logout',
      'new',
      'null',
      'profile',
      'settings',
      'setup',
      'today',
      'undefined'
    )
  )
);

create unique index nfc_tags_user_friendly_code_idx
on public.nfc_tags (user_id, friendly_code)
where friendly_code is not null;

alter table public.nfc_tags
add constraint nfc_tags_id_user_id_key
unique (id, user_id);

create table public.nfc_friendly_code_reservations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friendly_code text not null,
  tag_id uuid not null,
  reserved_at timestamptz not null default now(),
  constraint nfc_friendly_code_reservations_pkey
    primary key (user_id, friendly_code),
  constraint nfc_friendly_code_reservations_tag_owner_fk
    foreign key (tag_id, user_id)
    references public.nfc_tags (id, user_id)
    on delete cascade
);

comment on table public.nfc_friendly_code_reservations is
  'Permanent per-user friendly-code reservations. Rows are retained when a tag changes code or is revoked so an older physical URL cannot be reactivated accidentally.';

alter table public.nfc_friendly_code_reservations enable row level security;

create policy nfc_friendly_code_reservations_select_own
on public.nfc_friendly_code_reservations
for select
to authenticated
using (user_id = (select auth.uid()));

create policy nfc_friendly_code_reservations_insert_own
on public.nfc_friendly_code_reservations
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.nfc_tags
    where nfc_tags.id = nfc_friendly_code_reservations.tag_id
      and nfc_tags.user_id = (select auth.uid())
      and nfc_tags.friendly_code =
        nfc_friendly_code_reservations.friendly_code
  )
);

grant select, insert
on table public.nfc_friendly_code_reservations
to authenticated;

create function public.reserve_nfc_friendly_code()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_should_reserve boolean;
begin
  if auth.uid() is null
    or new.user_id <> auth.uid() then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    v_should_reserve := true;
  else
    v_should_reserve :=
      new.friendly_code is distinct from old.friendly_code;
  end if;

  if new.friendly_code is not null
    and v_should_reserve then
    insert into public.nfc_friendly_code_reservations (
      user_id,
      friendly_code,
      tag_id
    )
    values (
      new.user_id,
      new.friendly_code,
      new.id
    );
  end if;

  return new;
end;
$$;

create trigger reserve_nfc_friendly_code_after_write
after insert or update of friendly_code
on public.nfc_tags
for each row
execute function public.reserve_nfc_friendly_code();

revoke execute on function public.reserve_nfc_friendly_code()
from public, anon, authenticated;

drop function public.create_nfc_tag(uuid, text, text);

create function public.create_nfc_tag(
  p_bottle_id uuid,
  p_token_hash text,
  p_label text default null,
  p_friendly_code text default null
)
returns public.nfc_tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_constraint_name text;
  v_friendly_code text :=
    lower(nullif(pg_catalog.btrim(p_friendly_code), ''));
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

  if p_label is not null
    and pg_catalog.length(pg_catalog.btrim(p_label)) > 80 then
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

  begin
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
      p_bottle_id,
      p_token_hash,
      nullif(pg_catalog.btrim(p_label), ''),
      v_friendly_code,
      'active'
    )
    returning * into v_tag;

  exception
    when unique_violation then
      get stacked diagnostics
        v_constraint_name = CONSTRAINT_NAME;

      if v_constraint_name in (
        'nfc_tags_user_friendly_code_idx',
        'nfc_friendly_code_reservations_pkey'
      ) then
        raise exception 'Friendly code is unavailable'
          using errcode = 'P0001';
      end if;

      raise;
  end;

  return v_tag;
end;
$$;

drop function public.update_nfc_tag(uuid, uuid, text);

create function public.update_nfc_tag(
  p_tag_id uuid,
  p_bottle_id uuid,
  p_label text,
  p_friendly_code text
)
returns public.nfc_tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_constraint_name text;
  v_existing_tag public.nfc_tags%rowtype;
  v_friendly_code text :=
    lower(nullif(pg_catalog.btrim(p_friendly_code), ''));
  v_user_id uuid := auth.uid();
  v_tag public.nfc_tags%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if p_label is not null
    and pg_catalog.length(pg_catalog.btrim(p_label)) > 80 then
    raise exception 'Tag labels must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  select *
  into v_existing_tag
  from public.nfc_tags
  where nfc_tags.id = p_tag_id
    and nfc_tags.user_id = v_user_id
    and nfc_tags.status = 'active';

  if v_existing_tag.id is null then
    raise exception 'NFC tag is unavailable'
      using errcode = 'P0002';
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

  begin
    update public.nfc_tags
    set
      bottle_id = p_bottle_id,
      label = nullif(pg_catalog.btrim(p_label), ''),
      friendly_code = v_friendly_code
    where nfc_tags.id = p_tag_id
      and nfc_tags.user_id = v_user_id
      and nfc_tags.status = 'active'
    returning * into v_tag;

  exception
    when unique_violation then
      get stacked diagnostics
        v_constraint_name = CONSTRAINT_NAME;

      if v_constraint_name in (
        'nfc_tags_user_friendly_code_idx',
        'nfc_friendly_code_reservations_pkey'
      ) then
        raise exception 'Friendly code is unavailable'
          using errcode = 'P0001';
      end if;

      raise;
  end;

  return v_tag;
end;
$$;

revoke execute on function public.create_nfc_tag(uuid, text, text, text)
from public, anon;
revoke execute on function public.update_nfc_tag(uuid, uuid, text, text)
from public, anon;

grant execute on function public.create_nfc_tag(uuid, text, text, text)
to authenticated;
grant execute on function public.update_nfc_tag(uuid, uuid, text, text)
to authenticated;

commit;

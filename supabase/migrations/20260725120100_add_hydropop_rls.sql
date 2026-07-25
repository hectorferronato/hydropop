begin;

alter table public.profiles enable row level security;
alter table public.bottles enable row level security;
alter table public.hydration_goals enable row level security;
alter table public.nfc_tags enable row level security;
alter table public.devices enable row level security;
alter table public.hydration_events enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.bottles from anon, authenticated;
revoke all on table public.hydration_goals from anon, authenticated;
revoke all on table public.nfc_tags from anon, authenticated;
revoke all on table public.devices from anon, authenticated;
revoke all on table public.hydration_events from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.bottles to authenticated;
grant select, insert, update, delete on table public.hydration_goals to authenticated;
grant select, insert, update on table public.nfc_tags to authenticated;
grant select, insert, update on table public.devices to authenticated;
grant select, insert on table public.hydration_events to authenticated;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy bottles_select_own
on public.bottles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy bottles_insert_own
on public.bottles
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy bottles_update_own
on public.bottles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy hydration_goals_select_own
on public.hydration_goals
for select
to authenticated
using (user_id = (select auth.uid()));

create policy hydration_goals_insert_own
on public.hydration_goals
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy hydration_goals_update_own
on public.hydration_goals
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy hydration_goals_delete_own_future
on public.hydration_goals
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and effective_from > (
    select (statement_timestamp() at time zone profiles.timezone)::date
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

create policy nfc_tags_select_own
on public.nfc_tags
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.bottles
    where bottles.id = nfc_tags.bottle_id
      and bottles.user_id = (select auth.uid())
  )
);

create policy nfc_tags_insert_own
on public.nfc_tags
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.bottles
    where bottles.id = nfc_tags.bottle_id
      and bottles.user_id = (select auth.uid())
  )
);

create policy nfc_tags_update_own
on public.nfc_tags
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.bottles
    where bottles.id = nfc_tags.bottle_id
      and bottles.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.bottles
    where bottles.id = nfc_tags.bottle_id
      and bottles.user_id = (select auth.uid())
  )
);

create policy devices_select_own
on public.devices
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (
    bottle_id is null
    or exists (
      select 1
      from public.bottles
      where bottles.id = devices.bottle_id
        and bottles.user_id = (select auth.uid())
    )
  )
);

create policy devices_insert_own
on public.devices
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    bottle_id is null
    or exists (
      select 1
      from public.bottles
      where bottles.id = devices.bottle_id
        and bottles.user_id = (select auth.uid())
    )
  )
);

create policy devices_update_own
on public.devices
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (
    bottle_id is null
    or exists (
      select 1
      from public.bottles
      where bottles.id = devices.bottle_id
        and bottles.user_id = (select auth.uid())
    )
  )
)
with check (
  user_id = (select auth.uid())
  and (
    bottle_id is null
    or exists (
      select 1
      from public.bottles
      where bottles.id = devices.bottle_id
        and bottles.user_id = (select auth.uid())
    )
  )
);

create policy hydration_events_select_own
on public.hydration_events
for select
to authenticated
using (
  user_id = (select auth.uid())
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

create policy hydration_events_insert_own
on public.hydration_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
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

commit;

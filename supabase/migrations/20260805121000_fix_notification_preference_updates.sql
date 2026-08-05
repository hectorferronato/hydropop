begin;

create or replace function public.set_hydration_notification_preferences(
  p_pace_reminders_enabled boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_preferences public.hydration_notification_preferences%rowtype;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  insert into public.hydration_notification_preferences as preferences (
    user_id,
    pace_reminders_enabled
  )
  values (
    v_user_id,
    p_pace_reminders_enabled
  )
  on conflict (user_id) do update
  set pace_reminders_enabled = excluded.pace_reminders_enabled
  returning preferences.* into v_preferences;

  return pg_catalog.jsonb_build_object(
    'pace_reminders_enabled', v_preferences.pace_reminders_enabled,
    'updated_at', v_preferences.updated_at
  );
end;
$$;

revoke all on function public.set_hydration_notification_preferences(boolean)
from public, anon;

grant execute on function public.set_hydration_notification_preferences(boolean)
to authenticated;

comment on function public.set_hydration_notification_preferences(boolean) is
  'Owner-scoped notification preference upsert. The existing update trigger maintains updated_at.';

commit;

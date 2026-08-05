begin;

create or replace function public.register_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text,
  p_platform text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_endpoint_hash text;
  v_subscription_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  v_endpoint_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_endpoint, 'UTF8')),
    'hex'
  );

  insert into public.web_push_subscriptions as subscriptions (
    user_id,
    endpoint,
    endpoint_hash,
    p256dh,
    auth,
    user_agent,
    platform,
    expires_at,
    revoked_at
  )
  values (
    v_user_id,
    p_endpoint,
    v_endpoint_hash,
    p_p256dh,
    p_auth,
    p_user_agent,
    p_platform,
    p_expires_at,
    null
  )
  on conflict (endpoint_hash) do update
  set
    endpoint = excluded.endpoint,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    platform = excluded.platform,
    expires_at = excluded.expires_at,
    revoked_at = null
  where subscriptions.user_id = v_user_id
  returning subscriptions.id into v_subscription_id;

  if v_subscription_id is null then
    raise exception 'SUBSCRIPTION_UNAVAILABLE' using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'subscription_id', v_subscription_id,
    'active', true,
    'registered', true
  );
end;
$$;

revoke all on function public.register_web_push_subscription(
  text,
  text,
  text,
  text,
  text,
  timestamptz
)
from public, anon;

grant execute on function public.register_web_push_subscription(
  text,
  text,
  text,
  text,
  text,
  timestamptz
)
to authenticated;

comment on function public.register_web_push_subscription(
  text,
  text,
  text,
  text,
  text,
  timestamptz
) is
  'Owner-scoped Web Push registration. Derives identity from auth.uid() and returns no subscription secrets.';

commit;

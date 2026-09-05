select jsonb_build_object(
'extensions',(select jsonb_agg(extname) from pg_extension where extname in ('pg_cron','pg_net','supabase_vault')),
'cron_available',to_regclass('cron.job') is not null,
'http_history_available',to_regclass('net._http_response') is not null,
'vault_names',(select jsonb_agg(name) from vault.secrets where name='hydropop_push_worker_secret'),
'devices',(select jsonb_agg(x) from (select platform,count(*) as devices,count(*) filter(where revoked_at is null and (expires_at is null or expires_at>now())) as active,max(last_success_at) as last_accepted from public.web_push_subscriptions group by platform) x),
'preferences',(select jsonb_agg(x) from (select pace_reminders_enabled,count(*) from public.hydration_notification_preferences group by pace_reminders_enabled) x),
'state',(select jsonb_build_object('rows',count(*),'last_evaluation',max(last_evaluated_at),'last_reminder',max(last_reminder_sent_at),'pending',count(*) filter(where pending_outbox_id is not null)) from public.hydration_reminder_state)
) as audit;

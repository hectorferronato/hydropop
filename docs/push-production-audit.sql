-- Read-only. Deliberately excludes job command text, HTTP bodies, secrets and subscription credentials.
select jobid, jobname, schedule, active,
  command like '%https://hydropop-lake.vercel.app/api/internal/push-reminders/run%' as correct_endpoint,
  command like '%hydropop_push_worker_secret%' as expected_vault_name
from cron.job where jobname = 'hydropop-push-reminders';
select d.status, d.start_time, d.end_time
from cron.job_run_details d join cron.job j using (jobid)
where j.jobname = 'hydropop-push-reminders' order by d.start_time desc limit 12;
select name from vault.secrets where name = 'hydropop_push_worker_secret';
select status_code, timed_out, created from net._http_response order by created desc limit 12;
select platform, count(*) as devices,
 count(*) filter (where revoked_at is null and (expires_at is null or expires_at > now())) as active,
 max(last_success_at) as last_push_accepted_at
from public.web_push_subscriptions group by platform;
select pace_reminders_enabled, count(*) from public.hydration_notification_preferences group by pace_reminders_enabled;
select count(*) as state_rows, max(last_evaluated_at) as last_evaluation,
 max(last_reminder_sent_at) as last_reminder, count(*) filter (where pending_outbox_id is not null) as pending_users
from public.hydration_reminder_state;
select status, last_error_code, count(*), min(created_at) as oldest, max(created_at) as newest, max(attempts) as attempts
from public.push_notification_outbox group by status, last_error_code;

# Deployment, operations and troubleshooting

[Documentation hub](README.md) · [Security](security.md) · [Notifications](notifications.md)

## Environment discipline

The application runs on Vercel with a hosted Supabase backend. Production's
canonical origin is `https://hydropop-lake.vercel.app`. The existing GitHub main
branch is integrated with Vercel; publishing a commit there can deploy production.
Do not use a production release as a way to test documentation or a local experiment.

Before any database command, distinguish the CLI's linked project from the app's
`NEXT_PUBLIC_SUPABASE_URL`. Before deploying, distinguish Vercel Preview and
Production environment values. A correct local `.env.local` does not prove a
correct deployed environment. Never print tokens or decrypt Vault rows to compare them.

The commands below are separated into checks and deliberate mutations. They are
runbook instructions, not evidence that they ran during this documentation update.

## Read-only health checks

```sh
pnpm supabase migration list --linked
pnpm db:lint
pnpm supabase db push --linked --dry-run
pnpm supabase db query --linked --file docs/push-production-metadata.sql
```

The metadata query returns extension presence, the expected Vault entry **name**,
aggregate subscription/preference information and last reminder observations. It
works before Cron is installed. It does not print credential values.

`GET /api/v1/health` returns application liveness only. It does not probe Supabase,
VAPID, the device RPC secret, Cron or phone display. To verify a deployed GitHub
release when the integration is available:

```sh
gh api "repos/hectorferronato/hydropop/commits/$RELEASE_SHA/status" \
  --jq '{state: .state, checks: [.statuses[] | {context, state, description}]}'
```

Set `RELEASE_SHA` to the exact commit being checked. A successful Vercel check
must be followed by a production-domain smoke check of the changed behavior.

### Scheduler and delivery

After pg_cron/pg_net exist, run individual statements from
[push-production-audit.sql](push-production-audit.sql) in the SQL editor. The CLI
used by this repository may show only the last result of a multi-statement file.
The audit deliberately excludes job command bodies, HTTP bodies and subscription keys.

1. Confirm exactly one named `hydropop-push-reminders` job, active, with
   `*/15 * * * *`, the intended endpoint and expected Vault name.
2. Inspect recent `cron.job_run_details` **status/start/end only**. A successful SQL
   run means pg_net accepted the HTTP enqueue, not that the worker succeeded.
3. Inspect recent `net._http_response` status/timing for the matching time. Correlate
   carefully if other jobs use pg_net. Its history is transient.
4. Confirm evaluation timestamps advance and inspect the private Notifications page
   for eligibility/suppression. Do not force reminders past an intentional cooldown.
5. Confirm outbox completion and per-device acceptance. Ask for physical display
   confirmation separately; neither a 200 response nor acceptance proves it.

Safe interpretation: 401 suggests the authentication boundary rejected the
request; 503 from an unconfigured worker means inspect server configuration;
500 means examine safe worker/RPC logs. A 200 with zero sends can be correct:
check evaluated count and suppression before changing cadence.

## Database-first release

Use this sequence for an authorized change that includes a migration:

1. Review the diff, forward migration, current function grants, tests and compatibility.
2. Verify the exact target project. Run migration listing, dry-run and the required
   [validation commands](testing.md). Confirm only intended migrations are pending.
3. Deliberately apply the reviewed schema:

   ```sh
   pnpm supabase db push --linked
   pnpm db:lint
   pnpm db:types
   ```

4. Review generated types and rerun typecheck/tests/build against the applied schema.
   Do not overwrite generated types with an empty/failed CLI output unnoticed.
5. Publish the reviewed application through the established release process.
   If using main-branch Git deployment, stage explicit intended files, inspect the
   staged diff, commit and push. Do not force-push shared history.
6. Wait for the exact release's Vercel success status. Verify the production domain
   serves the release and critical private flows work with an authorized account.
7. Enable or update dependent scheduler/configuration only after the app is ready.
8. Observe a real scheduled run and record timestamps, safe counters and limitations.

Do not run seed data, use `--include-seed`, reset the linked database, disable RLS,
or expose service-role credentials as part of a normal release. Migrations already
applied in production are not edited or deleted to roll back a release.

## Provision integrations deliberately

| Situation                                         | Correct artifact / action                                                                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First Web Push installation with no worker secret | Review [initial Cron template](../supabase/templates/push-reminders-cron.sql.example); securely provision the matching server/Vault secret and existing/intended VAPID pair before scheduling |
| Existing Vault secret, missing Cron/pg_net job    | Review [repair template](../supabase/templates/repair-push-reminders-cron.sql.example); it enables extensions and creates the named job only if absent                                        |
| Physical-device backend first setup               | Review [physical RPC secret template](../supabase/templates/physical-device-rpc-secret.sql.example); hardware receives only its dedicated token                                               |
| Existing job has wrong schedule/endpoint          | Inspect safe metadata, then deliberately repair that same job; do not create another scheduler                                                                                                |

Templates can mutate production. They are not health checks. Never rerun an
initial secret-creation template blindly against an already-provisioned system.
Keep development and production credentials separate; keep existing production
VAPID keys unless a deliberate rotation is actually required.

## Troubleshooting

| Symptom                                        | Investigate first                                                           | Safe next step                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Login rejected                                 | Auth user, current email, server allowlist                                  | Correct intended environment/account configuration; do not bypass auth                |
| App shell loads but a page remains blank       | Network, route loading/error state, notification/deep-link path             | Use visible reload; reopen installed app for updates; inspect safe server errors      |
| Wrong daily totals                             | Member timezone, date-effective goal, effective events and snapshot volumes | Reproduce projection from synthetic data; never directly edit event history           |
| Recording duplicated                           | Whether client reused the original key/payload                              | Trace created versus replayed result; fix retry identity rather than delete rows      |
| NFC unavailable                                | Owner account, active tag, friendly reservation, active primary bottle      | Follow [NFC lifecycle](nfc.md); do not reassign reserved codes to another tag         |
| NFC half did not update last use               | `last_scanned_at` is full-confirmation only                                 | Verify intake; this timestamp behavior is intentional                                 |
| Button 401                                     | Token provisioned correctly or revoked                                      | Reprovision a new registration if revoked; never expose the token in logs             |
| Button 409                                     | Assigned bottle/archive state and goal setup                                | Owner repairs configuration through existing management flows                         |
| Button 422                                     | Occurrence time and offline/future limits                                   | Fix clock/retry behavior without silently changing known event time                   |
| Button server configuration failure            | Independent server/Vault RPC secret and current schema                      | Verify securely; do not send this secret to hardware                                  |
| Test push works but automatic reminders do not | Cron, HTTP results, evaluation timestamps and suppression                   | Follow the scheduler checklist before changing cadence                                |
| Browser has subscription but server does not   | Split registration state                                                    | Use Reconnect this device; do not rotate VAPID keys                                   |
| Push accepted but phone is silent              | Home Screen install, Notification permission, Focus, connectivity           | Verify actual phone display; server acceptance is a separate signal                   |
| Pending push never clears                      | Claim time, attempts, available-at and active preferences                   | Observe bounded recovery; inspect safe errors instead of manually incrementing counts |
| Community member unavailable                   | Joined state, visibility and username reservations                          | Respect hidden-profile privacy; do not expose raw events                              |
| RPC missing after deployment                   | Applied migrations and generated types versus app release                   | Deploy in database-first order; check the intended project                            |

## Incident containment and recovery

For an actively malfunctioning reminder scheduler, a deliberate pause can use the
existing named job's ID without exposing its command, using the
[Supabase Cron activation API](https://supabase.com/docs/guides/cron/quickstart#activatedeactivate-a-job).
In the SQL editor:

```sql
-- MUTATION: intentionally pauses this named job, if present.
select cron.alter_job(jobid, active := false)
from cron.job
where jobname = 'hydropop-push-reminders';
```

After fixing and validating the problem, use the same operation with `active := true`
for that job. Do not automatically pause healthy production just to investigate a
user who is correctly in cooldown. Stopping Cron prevents new scheduled runs;
a request already in progress can still finish.

For an application regression, use the normal Vercel release/rollback process,
but check schema compatibility first. Prefer a forward corrective migration over
ad hoc table edits or removal of migration history. Preserve immutable hydration
records and credential ownership during recovery.

Record the failing stage, release, environment, observed timestamps, safe codes,
impact and verification. Keep raw secrets, customer history and decrypted rows out
of the incident document. Date the evidence and separate an implemented fix from
physical verification that is still pending.

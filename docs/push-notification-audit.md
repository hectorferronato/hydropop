# HydroPOP Web Push audit — September 5, 2026

## Outcome and production evidence

**CONFIRMED OPERATIONAL ISSUE:** the linked database has no `pg_cron` or `pg_net` extension. `cron.job` and `net._http_response` do not exist. The documented automatic scheduler therefore cannot be running there. The local application's public Supabase URL matches this linked project. Vercel's deployed environment-to-project binding still requires verification; its local CLI is broken (missing `libsimdutf.34.dylib`).

Read-only metadata returned:

- Vault entry named `hydropop_push_worker_secret` exists; its value was never selected for output.
- Two preference rows, both enabled.
- Two iOS subscriptions and one macOS subscription; all three active, none revoked/expired.
- One reminder-state row, last evaluated **2026-08-05 19:43:23.868 UTC**.
- Last accepted reminder **2026-08-05 19:44:04.853 UTC** on both platforms.
- One outbox row: delivered, one attempt, no error. No stuck pending rows.
- Previously deployed notification migrations appear in linked migration history.
- An unauthenticated POST to the production worker returned **401**, consistent with a configured worker secret and an enforced authentication boundary. This does not establish Vault/Vercel secret equality or VAPID validity.

There is no evidence of recent automatic evaluation. Missing scheduling, rather than revoked phones, is the strongest explanation for the reported silence. Phone display and current authenticated worker delivery were not tested, and no test notification was sent by this audit.

## Architecture and failure points

| Stage                 | Existing behavior / possible stop                                                                                    | Audit result and change                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Cron         | 15-minute placeholder template, not installed by migrations                                                          | Correct intended schedule; extensions absent in linked database. Manual repair template provided, not run.                                                                                           |
| pg_net → Vercel       | POST bearer secret fetched from Vault, 10-second HTTP timeout                                                        | Endpoint code exists; HTTP 401 without credentials. Cron SQL success would only prove HTTP enqueue, not worker success. Inspect HTTP status separately.                                              |
| Worker authentication | SHA-256 digest and constant-time comparison; publishable-key Supabase client                                         | Preserved. No service role. Vault-authenticated narrow RPCs retain empty search paths.                                                                                                               |
| Evaluation claim      | Enabled users with active subscriptions; 50 candidates per run, oldest evaluated first; five-minute evaluation lease | Disabled/no-device users are skipped by SQL and explained by private diagnostics. Missing profiles cannot be candidates. Larger populations may need batch capacity review.                          |
| Authoritative inputs  | User timezone, date-effective hydration goal/target, profile wake time, primary bottle, effective event total        | Reused. Reversed/future events and fill-start markers excluded. Device/NFC/web events contribute by effective volume, independent of source.                                                         |
| Decision              | Shared Today expected-intake, tolerance and recommendation functions                                                 | Previous hardcoded window removed; one adaptive engine, typed decisions and safe reasons.                                                                                                            |
| Apply/enqueue         | Locked state, single-use evaluation token, unique user/day/sequence key, one pending outbox per user                 | Preserved; accepts behind/on-track/ahead and persists reason, observed pace and next eligibility.                                                                                                    |
| Outbox claim          | Pending/retry due timestamps, SKIP LOCKED, stale processing claims recovered after 15 minutes                        | Newly enqueued rows are explicitly due at evaluation time. Opt-outs, ended days/windows, reached goals and intervening hydration cancel stale advice. Abandoned claims stop after five attempts.     |
| Fanout                | One user decision, up to ten active subscriptions                                                                    | Devices fail independently. Previously one accepted device abandoned transient failures on others; accepted subscription IDs now prevent resending to successful devices while failed devices retry. |
| Sender                | VAPID, TTL 900 seconds, normal urgency                                                                               | Added 10-second per-send timeout. 404/410 and structurally malformed stored subscriptions retire only that device. Other failures use bounded exponential retry.                                     |
| Completion            | Claim token protects state/count updates                                                                             | Daily count advances once per user notification with at least one acceptance, even across partial retries. No test-route cadence effects.                                                            |
| Service worker        | One `/sw.js`, root scope, bounded JSON payload validation, same-origin allowlist                                     | Existing validation and click safety retained. Cache version bumped, registration bypasses HTTP cache, client claiming attached to activation lifetime.                                              |
| OS display            | Push-service acceptance precedes phone display                                                                       | Permissions, Focus, OS delivery and device connectivity remain physical-test questions. Acceptance is labeled explicitly, never presented as proof of display.                                       |
| Click                 | `/today?record=1&source=push` opens existing chooser                                                                 | Preserved. No hydration write occurs on click; user chooses an action.                                                                                                                               |

External push delivery cannot be exactly once: a process can die after acceptance but before completion is persisted. Retrying then can produce another acceptance. The stable notification tag replaces the visible pace notification where supported. Database claim/evaluation retries are idempotent; this transport ambiguity is not claimed solved.

## Confirmed implementation defects repaired

1. Profile wake/target times were ignored for notification eligibility (09:00–20:00 hardcoded).
2. Worker-start `p_now` preceded the database default `available_at`; first run could enqueue but not claim the new row. Explicit enqueue time removes that extra interval without changing locking.
3. iOS installation guidance ran after capability rejection, incorrectly labeling some tabs unsupported.
4. Existing browser subscriptions hid the enable/reconciliation action. A reconnect action is now always available, with a private current-device registration check and refreshed device count.
5. Any successful device ended the outbox attempt even when another device failed transiently. Partial retries now target only devices not already accepted.
6. Stale processing claims could recover forever, bypassing the normal retry bound.
7. Delivery claims did not recheck opt-out or stale hydration advice. Queued work is now cancelled when no longer appropriate.
8. A recent-hydration suppression formerly replaced the pace state, potentially starting another behind episode. Suppression now preserves authoritative pace separately from its reason; pending behind entry is retained across global cooldown.

No confirmed production service-worker delivery defect was observed. Lifecycle changes are defensive hardening, not a claim that the old worker caused the silence.

## Adaptive coaching design

Before this change: behind-only reminders, 90-minute repeats, 45-minute new-episode cooldown, 20-minute hydration quiet period, four reminders per local day, and a hardcoded 09:00–20:00 notification window. On-track and ahead users received no automatic pace notifications.

No intensity preference existed; only overall enablement. Added a minimal Gentle/Balanced/Frequent selector to the existing private page, defaulting existing users to Balanced without enabling anyone.

| Frequency          | Behind repeat | On track | Ahead   | Local-day maximum |
| ------------------ | ------------- | -------- | ------- | ----------------- |
| Gentle             | 90 minutes    | 4 hours  | 4 hours | 4                 |
| Balanced (default) | 60 minutes    | 3 hours  | 4 hours | 6                 |
| Frequent           | 45 minutes    | 2 hours  | 3 hours | 8                 |

All intervals are minimums; the 15-minute scheduler rounds actual delivery to its next evaluation. A meaningful new behind episode can send at its first evaluation, subject to a 45-minute global cooldown. Recovery ends the episode; returning behind can start another after that cooldown. Repeat cadence uses the latest attempted/accepted notification; supportive categories conservatively wait their full interval after any category. First supportive notification waits its interval from wake time.

Recent effective hydration suppresses behind messages for 20 minutes and supportive messages for 40 minutes. No reminders after goal completion. Missing goal, bottle or schedule suppresses with a specific reason. No hardcoded substitute schedule is introduced: incomplete setup must be completed. The existing Today overnight-window/date semantics are reused; local calendar date remains the accounting day. Date rollover resets counts and episode state but retains timestamps for global anti-spam protection.

Today's meaningfully-behind tolerance stays `max(100 ml, 5% of goal)`. Quantity copy uses the existing display-unit and half/full-bottle recommendation functions. Behind/on-track/ahead copy is supportive and contains no medical claims or private identifiers.

## Settings, diagnostics and privacy

The existing Profile → Notifications page retains enable, pause/resume, disable-device and current-device test actions. It adds frequency, browser-versus-server subscription state, reconnect and diagnostics:

- Last evaluation and authoritative pace observed at that evaluation.
- Last reminder and last push-service acceptance, not phone display confirmation.
- Next eligible timestamp, count today, configured window and timezone.
- Disabled, no subscription, worker not run in 30 minutes, pending delivery, or the latest decision/suppression reason.

The diagnostic RPC returns an explicit allowlist of metadata for `auth.uid()` only. No state table grants were added. Existing owner RLS remains on preference/subscription management; no anon table access was broadened. A read-only POST checks the current device using a hashed endpoint; the endpoint is kept out of URL logs. Raw subscription fields remain server-only in page output and worker responses.

`worker_not_run` is a stale-observation diagnostic, not an assertion that a particular Cron execution failed. Next eligibility is an estimate from the last decision, not a promise of delivery; edits, hydration, schedule changes and scheduler capacity can change it. Diagnostics refresh when the page reloads or settings change.

## Main files changed

- `lib/domain/coaching/pace-reminder.ts`: deterministic adaptive decision engine and bounded frequency policies.
- `app/api/internal/push-reminders/run/route.ts`: frequency/diagnostic RPC inputs and partial-device retries.
- `lib/infrastructure/push/send.ts`: bounded sends and stored encryption-key shape validation.
- `app/(private)/settings/notifications/{page,notification-settings}.tsx`: intensity, reconciliation and private diagnostics.
- `app/api/v1/{notification-preferences,push-subscriptions/status}/route.ts`: owner preference and registration checks.
- `lib/application/push/browser-support.ts`, `components/pwa-service-worker.tsx`, `public/sw.js`: capability guidance and service-worker lifecycle.
- `lib/contracts/push-notifications.ts`, `lib/infrastructure/supabase/database.types.ts`: strict API/schema contracts.
- New forward migration, manual Cron repair template, safe SQL audit files, and this report.
- Added PostgreSQL, mobile-capability and service-worker execution tests; updated cadence and worker fanout tests.

## Migration and types

One forward-only migration: `20260905130000_adaptive_push_reminders.sql`. It adds bounded frequency, three diagnostic fields and accepted-device retry bookkeeping, and replaces existing RPC definitions. Deployed migrations were not edited. RLS remains enabled. Notification timestamps remain `timestamptz`; volumes remain milliliters.

The checked-in Supabase types were updated to describe this pending schema (no `any`, no untyped Supabase client). Regenerate after applying the migration. The pre-existing subscription-RPC nullability adapter remains unchanged. No additional temporary compatibility types were introduced.

Old callers remain compatible through default RPC parameters. The migration must precede the new UI, which selects the new preference column.

## Validation

Final validation: `pnpm format`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (542 tests across 59 files), `pnpm test:e2e` (32 passed, 1 existing skip), `pnpm build`, `git diff --check`, `pnpm db:lint`, linked migration listing and linked dry-run passed. The browser server required permission to bind localhost; a stalled build was stopped and rerun. Transient duplicate generated `.next/types` declarations disappeared after the successful clean build, and typecheck was rerun afterward. Embedded PostgreSQL tests execute the new migration and worker RPCs without Docker. Browser tests exercise the existing app but cannot prove OS push display. Existing recording tests cover immutable edits/removals across web, NFC and physical-device sources; notification evaluator SQL uses that same effective-event model.

Linked migration listing and dry-run succeeded. The final dry-run selects **only `20260905130000_adaptive_push_reminders.sql`**. A dry-run lists migration applicability; it does not execute or validate the new function bodies. Linked database lint validates the currently deployed schema. Embedded PostgreSQL execution validates the pending function bodies.

## Database-first deployment and manual scheduler repair

None of these production writes was performed.

1. Review the diff and migration. Confirm the linked project is the one configured in the production Vercel deployment.
2. Deliberately apply the reviewed migration: `pnpm supabase db push --linked`. Verify only the named migration is pending first.
3. Regenerate types with `pnpm db:types`; inspect the generated diff. Run `pnpm db:lint` against the now-updated schema.
4. Deploy the reviewed application through the normal Git/Vercel release process.
5. In Vercel Production settings, verify the presence of `PUSH_WORKER_SECRET`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, and `WEB_PUSH_SUBJECT`. Confirm the worker secret matches the existing Vault entry using the secure administrative UI, without copying it to logs. Confirm the public/private VAPID pair is the existing pair. **Do not rotate keys.** `vercel env ls production` lists names when the CLI is repaired; this machine's CLI currently fails to launch.
6. Manually run `supabase/templates/repair-push-reminders-cron.sql.example` in the linked project's SQL editor. It enables missing extensions and creates the named 15-minute job only if absent, using the existing Vault entry. If a job exists, it skips creation and requires inspection. Do not run the older initial-secret template against an existing Vault setup.
7. Wait for the next quarter-hour. Run the safe audit statements separately. Expect Cron execution, then HTTP 200, then advancing private evaluation timestamps. Cron SQL success alone is insufficient.
8. Run the physical checks below. Pause the named job if the new worker fails; resolve errors before re-enabling it. Do not duplicate the job.

Supabase's official [Cron installation guide](https://supabase.com/docs/guides/cron/install) and [pg_net documentation](https://supabase.com/docs/guides/database/extensions/pg_net) describe the required extensions.

## Safe operational commands

From the repository:

```sh
pnpm supabase migration list --linked
pnpm supabase db push --linked --dry-run
pnpm db:lint
pnpm supabase db query --linked --file docs/push-production-metadata.sql
```

`push-production-metadata.sql` works before Cron installation and returns only safe aggregate metadata. After installation, run individual statements from `docs/push-production-audit.sql` in the SQL editor: this CLI returns only the last result when a file contains several statements. The latter file intentionally expects Cron and pg_net to exist. It selects no command bodies, bearer credentials, HTTP response bodies, subscription endpoints or encryption keys. HTTP history is recent, transient and may include other jobs; correlate timestamps carefully.

To investigate Bea specifically, use her own authenticated Notifications page; the audit does not expose or guess internal account identifiers. An administrator can compare aggregate worker/outbox observations with the private page's last evaluation and suppression reason.

## Physical iPhone acceptance checklist

- Open an ordinary iPhone browser tab: installation guidance must appear even if PushManager is missing.
- Install/open HydroPOP from the Home Screen; verify Notification permission, browser subscription and server registration independently. Use reconnect if registration is missing.
- Send a current-device test while the app is backgrounded/phone locked; confirm display. Verify tests leave reminder counts and cadence unchanged.
- With notifications enabled, within the configured schedule and meaningfully behind, wait for a scheduler evaluation after the hydration quiet period. Confirm an automatic notification, acceptance timestamp and one user-level count.
- Tap it: Record Water chooser opens; verify total is unchanged until choosing a recording action.
- Confirm on-track support after the selected interval, no immediate repeat after hydration, no pace message after reaching goal, and current-device disable affects only that install.
- If accepted but invisible, inspect OS permissions, Focus settings, connectivity and installed-app identity. Do not treat acceptance as display proof.

Home Screen installation is Apple's documented requirement for this iOS Web Push flow: [WebKit guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## Physical desktop acceptance checklist

- Open Chrome, grant permission through Enable, confirm active server registration and test display while the tab is backgrounded.
- Confirm the same user-level automatic decision reaches desktop and the installed phone; the daily count increases once.
- Disable one device and confirm the other remains registered. Reconnect an existing browser subscription and verify no duplicate registration.
- Repeat deep-link, quiet-period, supportive cadence and goal-completion checks. Verify notification taps never record automatically.

No firmware, Git push, deployment, production scheduler changes, migration push, seed data, Docker or local Supabase stack was used.

# Testing and validation

[Documentation hub](README.md) · [Contributing](../CONTRIBUTING.md)

## Required baseline

[AGENTS.md](../AGENTS.md) requires these after every task:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The build needs the environment described in [Getting started](getting-started.md).
Run build/type generation sequentially with typecheck if generated `.next` files
are changing; transient generated-type collisions are not a reason to weaken strict mode.

Choose additional checks for the affected area: formatting for edited files,
browser tests for UI changes, and linked database checks for schema work or releases.

```sh
pnpm format
pnpm format:check
pnpm test:e2e
pnpm db:lint
pnpm supabase migration list --linked
# Only if a migration is pending; this does not apply it:
pnpm supabase db push --linked --dry-run
git diff --check
```

`db:lint` connects to the linked database. It validates the deployed schema, not
unapplied local migrations. A migration dry-run checks applicability, not runtime
correctness of new SQL. Neither command needs Docker or `--local`.

## Test layers

| Location / tool                | What it establishes                                                                                      | What it does not establish                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `tests/unit`, Vitest           | Deterministic projection, pace, contracts, security helpers, browser capability and service-worker logic | Live Auth, live push-provider response or physical hardware behavior        |
| `tests/integration`, Vitest    | Route mocks, migration/grant assertions and embedded PostgreSQL RPC behavior                             | Live-database behavior unless the test explicitly exercises it              |
| PGlite-based integration tests | Actual SQL function/constraint behavior in an isolated embedded PostgreSQL database                      | Hosted Vault/Cron/pg_net operation or realistic production concurrency/load |
| `tests/e2e`, Playwright        | Navigation, responsive UI, auth boundaries and component interactions                                    | Full real-account flows when tests use fixtures, or iPhone OS push delivery |
| Physical acceptance            | Real NFC scan, installed-app notification display/tap, real button retries                               | Broad regression coverage by itself                                         |

Fixtures in embedded tests are isolated test data. They are not a command to run
`supabase/seed.sql` on a linked environment.

## Browser setup and scope

```sh
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

[playwright.config.ts](../playwright.config.ts) starts a development server on
port 3100 with `.next-playwright` output. Chromium runs desktop and Pixel-style
projects. Mobile Safari/WebKit runs the recording-actions and push-deep-link specs.
Some component fixtures deliberately block service workers so network interception
works in WebKit; these fixtures do not exercise real OS notification delivery.

The HTML report is in `playwright-report`; traces and artifacts are under
`test-results`. Treat captured artifacts as potentially private if you used real
accounts. Don't commit them.

## Focused commands

```sh
pnpm exec vitest run tests/unit/pace-reminder.test.ts
pnpm exec vitest run tests/integration/adaptive-push-database.test.ts
pnpm exec playwright test tests/e2e/push-deep-link.spec.ts
```

Use focused tests during iteration, then complete the required baseline. Expand
coverage for changed behavior, not to duplicate implementation details.

## Regression scenarios by feature

| Feature         | Essential scenarios                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Hydration       | Full/half snapshot amounts, replayed keys, reverse/edit/remove chains, future exclusion, DST and local-day rollover                         |
| Settings/setup  | Partial setup, missing primary/goal, unit conversion, profile versus effective-goal target semantics                                        |
| NFC             | Wrong owner, unavailable/revoked tag, reserved/renamed codes, full/half, rapid repeat, no GET writes                                        |
| Physical button | Credential validation, assigned bottle, status performs no writes, replay returns existing, revoked token, clock bounds                     |
| Push            | Disabled/no device/window/goal suppression, all intensities, global cooldown, retries/partial acceptance, stale claims, safe click fallback |
| Community       | Consent, hidden profiles, username reservations, limited fields and effective-event aggregates                                              |
| Frontend        | Keyboard/focus/Escape, pending/error states, 320 px width, preserved chooser after deep-link cleanup                                        |

## Interpreting failures

- Missing browser executable: install the browsers declared by the project.
- Local server cannot bind: check port usage and execution permissions; do not
  switch browser tests to production to avoid the problem.
- Missing RPC/table: confirm which project is linked and whether the migration is applied.
- Generated type errors after a build: finish the build, inspect generated artifacts,
  then rerun typecheck. Do not edit generated declarations to hide an error.
- Linked lint warning: inspect the exact SQL function on the deployed schema before
  claiming the new local migration is healthy.
- A mocked push test passes but a phone is silent: follow the notification runbook;
  provider acceptance and OS display are separate stages.

Record command results and limitations in the change summary. Test counts are
revision-specific evidence, not a permanent quality target.

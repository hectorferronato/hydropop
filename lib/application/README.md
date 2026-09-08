# Application use cases

[Documentation hub](../../docs/README.md) · [Architecture](../../docs/architecture.md)

This layer coordinates validated input, authoritative domain behavior and persistence.
Routes/actions derive identity before calling use cases; database constraints/RLS/RPCs
still enforce ownership and atomicity. Keep framework-free calculations in `lib/domain`.

| Directory                               | Responsibility                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `hydration/`                            | Read projections, record full/half/events, immutable corrections and shared revalidation             |
| `onboarding/`, `settings/`              | Setup completeness, unit conversion and persisted configuration changes                              |
| `nfc/`                                  | Identifier resolution, credential issuance and deliberate confirmation                               |
| `device/`                               | Dedicated token authentication, compact firmware responses and shared pace mapping                   |
| `push/`                                 | Browser support detection and subscription security helpers; worker orchestration stays in its route |
| `analytics/`, `calendar/`, `community/` | View-model and aggregate presentation rules                                                          |
| `auth/`, `http/`, `urls/`               | Allowlist, safe destinations/errors, bounded input and canonical origin                              |
| `refresh/`, `celebration/`              | Visible refresh scheduling and confirmed-action feedback                                             |

Inject data/clock dependencies where the existing use case supports it so behavior
can be tested deterministically. Preserve a request's idempotency key across retries.
After a new hydration mutation, use `revalidate-hydration-views.ts` rather than an
incomplete per-route list of refresh targets. A failed data read is not a zero history.

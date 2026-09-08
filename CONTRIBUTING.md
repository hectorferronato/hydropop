# Contributing to HydroPOP

Start with the [documentation hub](docs/README.md), [local setup](docs/getting-started.md)
and [architecture](docs/architecture.md). Follow [AGENTS.md](AGENTS.md).

## Before changing behavior

Inspect the existing use case, contract and latest relevant migrations. Keep work
in the main web/backend repository unless a firmware change is explicitly in
scope. Do not introduce AI, payments, Bluetooth, push, or native apps as an
unrequested feature; maintain the existing authorized notification system through
its current boundaries.

Use a dedicated development account/project for intentional recording tests.
Local app code can write to a hosted project. Never seed, reset or migrate a
production project merely to make a test pass.

## Implementation expectations

- TypeScript remains strict; avoid `any` and keep temporary RPC type adapters narrow.
- Derive identities on the server and enforce data authorization in RLS/RPCs.
- Reuse immutable event processing, shared pace and centralized revalidation.
- Maintain integer ml and IANA-local date semantics, including DST and historical goals.
- Preserve idempotency, safe errors, accessible controls and no-write-on-navigation behavior.
- Add forward-only migrations. Regenerate types only from the intended applied schema.
- Never commit secrets, local environment files, generated browser artifacts or device tokens.

## Review and validation

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` after every task.
Use [Testing](docs/testing.md) for formatting, browser, SQL and physical checks.
A documentation-only change should validate links and commands against the repo;
it does not need new behavior-mirroring tests.

A review description should state the problem, resulting behavior, meaningful
validation and remaining limitations. For schema work, include migration name,
compatibility and database-first rollout. For hardware/PWA work, distinguish
emulated coverage from physical verification.

Production release is a separate deliberate action under the
[operations runbook](docs/operations.md). Ordinary documentation work does not imply production writes.

## Documentation maintenance

| Change                                     | Update                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| Environment or setup                       | `.env.example`, `docs/getting-started.md`                                  |
| Route method or schema                     | `docs/api-reference.md`, relevant feature guide                            |
| Event, pace, units or historical semantics | `docs/hydration.md`, source-level domain guide, affected integration guide |
| UI navigation or user flow                 | `docs/frontend.md` and relevant feature guide                              |
| SQL/RLS/grants/credential boundary         | `docs/backend.md`, `docs/security.md`, rollout notes                       |
| NFC or hardware contract                   | `docs/nfc.md` or `docs/physical-buttons.md`                                |
| Notification policy or operations          | `docs/notifications.md`, `docs/operations.md`                              |

Prefer one canonical explanation with links over multiple competing copies.
Keep the README a useful entry point. Label incident evidence by date and do not
turn an old successful test into a claim of current production health. Use
synthetic examples and validate relative source links before completing the task.

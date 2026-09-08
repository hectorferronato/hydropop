# HydroPOP

HydroPOP is a mobile-first hydration tracker for a private pilot. Record a full or
half bottle from the web app or an NFC confirmation page; an authenticated
physical button can record a completed bottle through the same backend. Today,
Calendar, Trends, Community, and reminders all build on immutable hydration history.

**[Documentation hub](docs/README.md)** · **[Local setup](docs/getting-started.md)** ·
**[Architecture](docs/architecture.md)** · **[Contributing](CONTRIBUTING.md)**

## What is in this repository?

| Area                   | Implementation                                                       | Guide                                          |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| Web app                | Next.js App Router, React, strict TypeScript, Tailwind CSS           | [Frontend](docs/frontend.md)                   |
| Data and authorization | Supabase Auth, PostgreSQL, RLS and transactional RPCs                | [Backend](docs/backend.md)                     |
| Hydration              | Snapshot volumes, effective events, local days, goals and pace       | [Domain rules](docs/hydration.md)              |
| NFC                    | Owner-scoped URLs, pilot activation, explicit full/half confirmation | [NFC](docs/nfc.md)                             |
| Physical buttons       | Credential provisioning, read-only status, idempotent completion API | [Button integration](docs/physical-buttons.md) |
| Web Push               | Opt-in subscriptions, adaptive cadence, transactional outbox, Cron   | [Notifications](docs/notifications.md)         |
| Private Community      | Consent, usernames, visibility and limited member summaries          | [Community](docs/community.md)                 |

This repository owns the web application and button **backend contract**. Hardware
firmware lives separately; pin mappings, provisioning transport and press-duration
thresholds are not defined here. Source enums supporting historical transports do
not imply that native apps, Bluetooth or every named transport is implemented.

## Start developing

Use Node.js 20.9 or newer and the package-manager version pinned in
[package.json](package.json) (`pnpm@11.9.0` at this revision).

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill in the required values using the setup guide before starting.
pnpm dev
```

Open `http://localhost:3000`. Use a dedicated hosted development Supabase project:
local application requests write to whichever project its environment points to.
[Setup and environment reference](docs/getting-started.md) covers authentication,
optional integrations and the first successful recording.

## Engineering rules

- Persist volumes as integer milliliters; convert ml/US fl oz only at boundaries.
- Store timestamps as `timestamptz`; derive hydration dates in the member's IANA timezone.
- Hydration events are immutable. Corrections append history rather than update/delete it.
- GET requests never record water. Device events require stable idempotency keys.
- Keep identity and authorization on the server and in RLS/RPCs. No service-role client.
- Keep secrets out of Git, responses and logs. Only explicitly `NEXT_PUBLIC_` values belong in client code.

[AGENTS.md](AGENTS.md) contains the repository's engineering instructions.

## Validate a change

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run these after every task. Formatting, browser tests and database checks are
covered in [Testing](docs/testing.md). Production changes follow the
[operations runbook](docs/operations.md); a documentation edit does not deploy the app.

## Production and historical evidence

Canonical production origin: [hydropop-lake.vercel.app](https://hydropop-lake.vercel.app).
The repository is integrated with Vercel through its GitHub main branch.

The September 5 notification audit and restoration reports are dated evidence,
not live health dashboards. Use [current operational checks](docs/operations.md)
to establish present health. Begin with the [documentation hub](docs/README.md)
for the complete reading map and historical reports.

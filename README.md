# HydroPOP

HydroPOP is a mobile-first hydration tracker built with Next.js, React, TypeScript,
Tailwind CSS, and Supabase. The repository contains authentication, protected
navigation, database migrations with row-level security, and test tooling.

## Prerequisites

- Node.js 20.9 or newer
- pnpm 11
- A linked Supabase project

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in `.env.local`:

   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key.
   - `NEXT_PUBLIC_SITE_URL`: `http://localhost:3000` locally and the canonical
     HTTPS URL in production.
   - `ALLOWED_EMAILS`: comma-separated email addresses permitted to sign in.

4. In the Supabase dashboard:

   - Keep email/password authentication enabled.
   - Create each allowed user manually under Authentication → Users. The app has
     no public sign-up flow and does not use a service-role key.
   - Set the Auth site URL and allowed redirect URLs to match
     `NEXT_PUBLIC_SITE_URL`.

5. Start the development server:

   ```bash
   pnpm dev
   ```

Never commit `.env.local`. The publishable key is intended for browser use, but
all authorization must still be enforced by Supabase Row Level Security once
application tables are introduced.

## Commands

| Command             | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `pnpm dev`          | Run the Next.js development server        |
| `pnpm build`        | Create a production build                 |
| `pnpm start`        | Serve the production build                |
| `pnpm lint`         | Run ESLint                                |
| `pnpm typecheck`    | Run strict TypeScript checks              |
| `pnpm test`         | Run Vitest unit tests                     |
| `pnpm test:e2e`     | Run Playwright browser tests              |
| `pnpm db:lint`      | Lint the linked public database schema    |
| `pnpm db:types`     | Regenerate linked Supabase database types |
| `pnpm format`       | Format supported files with Prettier      |
| `pnpm format:check` | Check formatting without changing files   |

Install the Playwright browser once before running end-to-end tests:

```bash
pnpm exec playwright install chromium
```

## Architecture

- `app/` contains App Router pages, route handlers, and private route layouts.
- `components/` contains reusable application-shell and UI components.
- `lib/domain/` reserves framework-free hydration and coaching logic.
- `lib/application/` reserves use cases that orchestrate domain behavior.
- `lib/infrastructure/supabase/` owns Supabase clients, auth verification, and
  session refresh.
- `lib/contracts/` reserves external API schemas.
- `lib/units/` reserves strongly typed unit conversion helpers.
- `supabase/` contains reproducible SQL migrations and development seed data.
- `tests/` contains unit and end-to-end tests.

Authentication uses Supabase's SSR package and cookie-backed sessions. The root
`proxy.ts` refreshes sessions and performs an optimistic redirect for protected
routes. The private App Router layout independently verifies the JWT, fetches a
fresh user record, and applies the server-only email allowlist before rendering.
Login accepts email and password only. Safe internal destinations—including
public NFC links under `/t/[token]`—are preserved through login and first-time
setup without allowing external redirects.

The mobile-first setup wizard writes profile preferences, the current
date-effective hydration goal, and the primary bottle through the
`save_onboarding` PostgreSQL function. The function is security-invoker,
derives ownership from `auth.uid()`, and performs the changes atomically under
RLS. Browser-facing volumes follow the user's preferred unit; persisted volumes
remain integer milliliters.

The everyday hydration gesture is one HydroPOP press immediately after the
final sip of a normally filled bottle. A `bottle_completed` event immediately
credits the bottle’s optional `typical_fill_ml`, falling back to `capacity_ml`
when no typical fill is configured. That effective amount is copied into the
immutable event’s `volume_ml` and metadata, so later bottle edits cannot change
historical totals. Partial fills are not inferred; manual intake, signed
adjustments, and reversals provide explicit corrections.

Legacy `fill_started`, `refill`, and `bottle_finished` rows remain supported by
the projection layer for historical compatibility, but normal API clients can
create only `bottle_completed`, `manual_intake`, `adjustment`, and
`event_reversed`. New completion events have no bottle-cycle state and require
no preceding fill.

Reversals append an `event_reversed` audit row. The original row is never
changed or deleted. Effective-history reconstruction excludes the reversed
original from both credited intake and cycle state, while retaining both rows
in the timeline. Retrying an event with the same user-scoped idempotency key
returns the original successful event rather than inserting a duplicate.

`occurred_at` determines event order and the user's IANA-local hydration date;
`received_at` remains the server audit timestamp. The event API accepts offline
events up to seven days old and five minutes of positive clock skew.

The current versioned resources are:

- `POST /api/v1/hydration-events`
- `GET /api/v1/dashboard/today`
- `GET /api/v1/calendar?month=YYYY-MM`
- `GET` and `POST /api/v1/bottles`
- `GET` and `PUT /api/v1/settings`

Every API derives identity from the verified Supabase session and returns a
stable `{ data, error }` envelope. Raw Supabase and PostgreSQL errors are never
returned to clients.

Future NFC confirmation will create `bottle_completed` only. It must not create
`fill_started`, `refill`, or `bottle_finished`; NFC implementation is outside
the current scope.

## Deployment

The app is compatible with Vercel's Next.js runtime. Configure the same four
environment variables for Preview and Production, using the appropriate site URL
for each environment. No service-role or database secret is required for this
foundation.

## Linked database development

The migrations create `profiles`, `bottles`, `hydration_goals`, `nfc_tags`,
`devices`, immutable `hydration_events`, transactional onboarding, and atomic
hydration-event processing. Every user-owned table has RLS enabled. Related
bottle and device ownership is enforced by composite foreign keys, policies,
and the security-invoker RPC. This repository uses the linked project for
database linting, migration review, and generated types; Docker is not required.

`supabase/seed.sql` is never included in an ordinary linked database push. Do
not add `--include-seed` to a remote deployment.

Regenerate TypeScript database types from the linked project after its
migrations are applied:

```bash
pnpm db:types
```

To review a remote deployment without applying it:

```bash
pnpm supabase login
pnpm supabase link --project-ref "$SUPABASE_PROJECT_REF"
pnpm supabase migration list --linked
pnpm supabase db push --linked --dry-run
```

After reviewing the output and obtaining explicit approval for the schema change:

```bash
pnpm supabase db push --linked
pnpm supabase db lint --linked --schema public --fail-on warning
pnpm db:types
```

Generated types must be refreshed only after the linked migration is applied.
Never pass database passwords, access tokens, or connection strings on a shared
command line or commit them to the repository.

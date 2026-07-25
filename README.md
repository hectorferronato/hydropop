# HydroPOP

HydroPOP is a mobile-first hydration tracker built with Next.js, React, TypeScript,
Tailwind CSS, and Supabase. The repository contains authentication, protected
navigation, database migrations with row-level security, and test tooling.

## Prerequisites

- Node.js 20.9 or newer
- pnpm 11
- Docker Desktop for the local Supabase stack
- A Supabase project

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

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Run the Next.js development server       |
| `pnpm build`        | Create a production build                |
| `pnpm start`        | Serve the production build               |
| `pnpm lint`         | Run ESLint                               |
| `pnpm typecheck`    | Run strict TypeScript checks             |
| `pnpm test`         | Run Vitest unit tests                    |
| `pnpm test:e2e`     | Run Playwright browser tests             |
| `pnpm db:start`     | Start the local Supabase stack           |
| `pnpm db:reset`     | Reapply local migrations without seeding |
| `pnpm db:lint`      | Lint the local public database schema    |
| `pnpm db:types`     | Regenerate local Supabase database types |
| `pnpm format`       | Format supported files with Prettier     |
| `pnpm format:check` | Check formatting without changing files  |

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

## Deployment

The app is compatible with Vercel's Next.js runtime. Configure the same four
environment variables for Preview and Production, using the appropriate site URL
for each environment. No service-role or database secret is required for this
foundation.

## Database development

The migrations create `profiles`, `bottles`, `hydration_goals`, `nfc_tags`,
`devices`, immutable `hydration_events`, and the transactional onboarding
function. Every user-owned table has RLS enabled. Related bottle and device
ownership is enforced by both composite foreign keys and policy checks.

Start Supabase and recreate the local schema without seed data:

```bash
pnpm db:start
pnpm db:reset
pnpm db:lint
```

The reset intentionally uses `--no-seed`: Bea's seed data must run only after her
Auth account exists. Create that account in the local Auth instance, then execute
`supabase/seed.sql` while supplying exactly one custom PostgreSQL setting:

```bash
PGOPTIONS="-c hydropop.seed_user_email=${HYDROPOP_SEED_USER_EMAIL}" \
  pnpm supabase db query --local --file supabase/seed.sql
```

The seed also accepts an existing Auth UUID:

```bash
PGOPTIONS="-c hydropop.seed_user_id=${HYDROPOP_SEED_USER_ID}" \
  pnpm supabase db query --local --file supabase/seed.sql
```

Set exactly one of those shell variables at execution time. The SQL looks up the existing
`auth.users` row and fails without inserting data if it cannot find exactly the
requested user. It never creates an Auth user or hard-codes a nonexistent UUID.
It seeds Bea's profile, a 710 ml Owala bottle, a 2130 ml goal, a simulated charm,
and four weeks of bottle-cycle events including adjustment and reversal examples.

Regenerate TypeScript database types after the local migrations are applied:

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
pnpm supabase db lint --linked --schema public --fail-on error
```

Do not add `--include-seed` to a production push. Never pass database passwords,
access tokens, or connection strings on a shared command line or commit them to
the repository.

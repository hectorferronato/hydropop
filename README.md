# HydroPOP

HydroPOP is a mobile-first hydration tracker built with Next.js, React, TypeScript,
Tailwind CSS, and Supabase. This repository currently contains the application
foundation: authentication, protected navigation, project conventions, and test
tooling. Hydration tracking and database migrations will be added separately.

## Prerequisites

- Node.js 20.9 or newer
- pnpm 11
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

| Command             | Purpose                                 |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Run the Next.js development server      |
| `pnpm build`        | Create a production build               |
| `pnpm start`        | Serve the production build              |
| `pnpm lint`         | Run ESLint                              |
| `pnpm typecheck`    | Run strict TypeScript checks            |
| `pnpm test`         | Run Vitest unit tests                   |
| `pnpm test:e2e`     | Run Playwright browser tests            |
| `pnpm format`       | Format supported files with Prettier    |
| `pnpm format:check` | Check formatting without changing files |

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
- `supabase/` contains local seed scaffolding. Database migrations intentionally
  start in the next implementation task.
- `tests/` contains unit and end-to-end tests.

Authentication uses Supabase's SSR package and cookie-backed sessions. The root
`proxy.ts` refreshes sessions and performs an optimistic redirect for protected
routes. The private App Router layout independently verifies the JWT, fetches a
fresh user record, and applies the server-only email allowlist before rendering.

## Deployment

The app is compatible with Vercel's Next.js runtime. Configure the same four
environment variables for Preview and Production, using the appropriate site URL
for each environment. No service-role or database secret is required for this
foundation.

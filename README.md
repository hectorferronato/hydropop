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
   - `NEXT_PUBLIC_SITE_URL`: `http://localhost:3000` locally and
     `https://hydropop-lake.vercel.app` in production. Do not add a trailing
     slash.
   - `ALLOWED_EMAILS`: comma-separated email addresses permitted to sign in.

4. In the Supabase dashboard:

   - Keep email/password authentication enabled.
   - Create each allowed user manually under Authentication → Users. The app has
     no public sign-up flow and does not use a service-role key.
   - Set the Auth site URL and allowed redirect URLs to the canonical
     `https://hydropop-lake.vercel.app` deployment.

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
public NFC links under `/t/[identifier]`—are preserved through login and first-time
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
- `GET` and `POST /api/v1/nfc-tags`
- `PUT /api/v1/nfc-tags/[id]`
- `POST /api/v1/nfc-tags/[id]/rotate`
- `POST /api/v1/nfc-tags/[id]/revoke`
- `POST /api/v1/nfc-tags/complete`

Every API derives identity from the verified Supabase session and returns a
stable `{ data, error }` envelope. Raw Supabase and PostgreSQL errors are never
returned to clients.

## NFC behavior-validation prototype

The Device area provisions and manages NFC tags for validating the future
HydroPOP Charm gesture. The user scans the tag, reviews a mobile confirmation
page, and explicitly chooses **Record one bottle** or **Record half**. Only an
authenticated confirmation POST records hydration. Opening, refreshing,
navigating back to, viewing Today, or cancelling never records hydration and
never changes tag state.

Every tag retains its secure identifier: 32 cryptographically random bytes
encoded as a 43-character base64url string. Its URL is a secret locator.
HydroPOP validates its format, stores only its lowercase SHA-256 digest, and
resolves it through an exact unique-index lookup scoped to the authenticated
owner. The raw token is returned only by create and rotate API responses and
cannot be recovered from the database afterward. The pilot interface
intentionally hides that advanced URL and shows only the friendly URL; existing
secure URLs and the rotation API remain backward compatible.

For the friends-and-family pilot, a tag may also have a memorable friendly code
such as `bea-kitchen`. Friendly codes are normalized to lowercase and are not
secret credentials. They resolve only after authentication and only among the
signed-in owner’s active tags, so different users may independently use the
same code. Codes are permanently reserved per user, including after a code
change or revocation. This prevents an older physical tag URL from becoming
valid again accidentally. Changing a friendly code invalidates its previous
friendly URL immediately without rotating the secure identifier. Rotating the
secure identifier does not change the friendly URL. Revocation disables both.

Tag management supports:

- creation for the authenticated user’s active primary bottle;
- optional labels, friendly pilot codes, and bottle reassignment;
- revocation without deleting the tag or hydration history;
- last confirmed-use display through `last_scanned_at`.

For this MVP, `last_scanned_at` means the timestamp of the latest successful
confirmed full-bottle NFC completion. A read-only scan, half intake, View Today,
or Cancel does not update it.

The NFC completion adapter accepts only the identifier, semantic `full` or
`half` action, occurrence timestamp, idempotency key, and an explicit
rapid-repeat confirmation flag. It derives the user and bottle on the server
and calls the same atomic hydration processor used by the normal event API. A
full action creates `bottle_completed`; the processor derives and snapshots
`typical_fill_ml ?? capacity_ml`. A half action reuses `manual_intake` and the
server calculates `round((typical_fill_ml ?? capacity_ml) / 2)` in integer
milliliters. The browser never supplies the user, bottle, or volume. Half intake
adds hydration without increasing the completed-bottle count and remains
reversible through immutable history. Reusing an idempotency key returns the
original event. A second effective full completion for the same bottle within
60 seconds shows a warning and requires another deliberate confirmation.

While Today is visible and online, a small pilot controller checks for
cross-device updates every five seconds. It pauses while hidden or offline,
refreshes promptly after focus, visibility return, or local hydration changes,
and prevents overlapping requests. This temporary polling can later be replaced
by realtime subscriptions or device synchronization.

### Writing and testing a physical NFC tag

1. Create a tag with a friendly code under `/device/nfc`.
2. Copy the displayed friendly NFC URL.
3. Open an NFC-writing app such as NFC Tools or an equivalent.
4. Choose to write a URL/URI record.
5. Paste the HydroPOP URL and write it to the tag.
6. Scan and test the complete authenticated confirmation flow.
7. Do not lock the physical tag during early validation.

Local URLs use `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, producing
`http://localhost:3000/t/{identifier}`. Production must set
`NEXT_PUBLIC_SITE_URL=https://hydropop-lake.vercel.app`, producing
`https://hydropop-lake.vercel.app/t/{identifier}`. URL construction uses one
validated origin utility, removes a trailing slash, has no fallback Vercel
domain, and fails during Next startup/build if the value is missing or invalid.

Verify the same canonical origin manually in both places before provisioning
physical tags:

- Vercel Production environment:
  `NEXT_PUBLIC_SITE_URL=https://hydropop-lake.vercel.app`
- Supabase Authentication URL configuration: site URL and permitted redirect
  URLs for `https://hydropop-lake.vercel.app`

The future transport mapping is intentionally simple:

- NFC confirmation → `bottle_completed`
- NFC half confirmation → `manual_intake` with a server-calculated volume
- Future charm short press → `bottle_completed`

The hydration engine and immutable event remain identical; only the client
transport changes. Browser-based NFC writing, Bluetooth, native mobile code,
and a simulated electronic charm are not part of this phase.

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

# Getting started

[Documentation hub](README.md) · [Operations](operations.md) · [Testing](testing.md)

## Prerequisites

- Node.js >=20.9 and `pnpm@11.9.0`, as declared in [package.json](../package.json).
- A hosted Supabase project you are authorized to use. Prefer a separate development project.
- An email/password Supabase Auth user whose email is in this environment's allowlist.
- Git. Database tasks use the repository's Supabase CLI dependency.

The normal workflow uses hosted Supabase. Docker, a local Supabase stack, and
seed execution are not prerequisites. Do not reset or seed a linked project to
get the web app running.

## Install and configure

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Edit `.env.local` privately. The checked-in [.env.example](../.env.example) contains
placeholders, not working credentials. Never copy secrets into issue reports or
shared terminal commands.

| Variable                                | Where used                                                        | Required for                                                                         |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`              | Browser and server Supabase clients                               | Base app                                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | Browser and server clients; authorization still enforced by RLS   | Base app                                                                             |
| `NEXT_PUBLIC_SITE_URL`                  | Canonical origin and NFC URL creation; validated at startup/build | Base app; use `http://localhost:3000` locally                                        |
| `ALLOWED_EMAILS`                        | Server-only comma-separated sign-in allowlist                     | Access to private pages/APIs                                                         |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Browser PushManager registration                                  | Opt-in Web Push                                                                      |
| `WEB_PUSH_VAPID_PRIVATE_KEY`            | Server sender; matching existing public key                       | Web Push delivery                                                                    |
| `WEB_PUSH_SUBJECT`                      | Server VAPID contact (`mailto:` or HTTPS URI)                     | Web Push delivery                                                                    |
| `PUSH_WORKER_SECRET`                    | Server worker authentication; 64 hexadecimal characters           | Scheduler; same value in Vault entry `hydropop_push_worker_secret`                   |
| `PHYSICAL_DEVICE_RPC_SECRET`            | Server-to-database device boundary; independent 64-hex secret     | Physical button API; same value in Vault entry `hydropop_physical_device_rpc_secret` |
| `HYDROPOP_NEXT_DIST_DIR`                | Next.js build output override                                     | Optional; Playwright uses `.next-playwright`                                         |

Missing optional integration credentials do not provide working integrations:
notification enablement/worker or button requests will fail safely until configured.
Do not generate replacement production VAPID keys while setting up development.
Use development credentials and subscriptions for a development environment.

## Configure Supabase Auth and schema

1. Enable email/password authentication and create pilot users administratively.
   There is no public sign-up flow.
2. Configure the Auth site URL and permitted redirects for the environment's
   canonical origin. Keep the production origin separate from localhost.
3. Set the server allowlist to the users permitted in this deployment. Creating
   an Auth user alone does not grant application access.
4. Check the linked project's migration state before using schema-dependent features:

   ```sh
   pnpm supabase login
   pnpm supabase link --project-ref "$SUPABASE_PROJECT_REF"
   pnpm supabase migration list --linked
   pnpm supabase db push --linked --dry-run
   ```

   Set `SUPABASE_PROJECT_REF` to the intended project reference. Linking changes
   CLI context; it does not rewrite the app's `.env.local`. Verify both point to
   the intended environment. Applying migrations is a separate deliberate step
   described in [Operations](operations.md#database-first-release).

## Run and verify

```sh
pnpm dev
```

1. Open `http://localhost:3000/auth/login` and sign in with an allowed account.
2. Complete setup: display name, IANA timezone, units, wake time, goal target time,
   daily goal, and primary bottle capacity/typical fill.
3. Open Today. Confirm the goal and bottle match the saved setup.
4. On a development account, deliberately record half a bottle. Verify it adds
   half the normal fill, rounded to integer milliliters, without increasing the
   completed-bottle count.
5. Remove that recording through the UI and confirm totals return to their prior
   value. The database retains the original and its reversal.

Setup can provision the owner-scoped `pilot` NFC tag atomically. An existing
partial setup may route to Settings; complete missing profile, goal or primary
bottle fields rather than deleting the account. The onboarding status rules are
in [onboarding-status.ts](../lib/application/onboarding/onboarding-status.ts).

## Device testing is different from localhost testing

A phone scanning `http://localhost:3000/t/...` addresses the phone itself, not
your laptop. Use a reachable HTTPS development deployment for NFC and installed
PWA testing. Create the tag in that environment so its canonical URL is correct.
See [NFC commissioning](nfc.md#writing-and-testing-a-physical-nfc-tag) and
[notification checks](notifications.md#physical-device-verification).

## Common setup failures

| Symptom                           | Check                                                                       |
| --------------------------------- | --------------------------------------------------------------------------- |
| Build fails before serving pages  | Valid `NEXT_PUBLIC_SITE_URL`; Next config validates it at startup           |
| Login works but access is denied  | The deployment's `ALLOWED_EMAILS` and the current Auth user's email         |
| Tables/functions are missing      | App URL, CLI linked project and migration history are aligned               |
| Recording asks for configuration  | Active date-effective goal and non-archived primary bottle                  |
| Playwright cannot launch          | Install Chromium and WebKit: `pnpm exec playwright install chromium webkit` |
| Local app changes production data | Its Supabase URL points at production; use a separate development project   |

The public health route only proves the application can respond; it does not
verify Auth, SQL, physical-device credentials or notification delivery.

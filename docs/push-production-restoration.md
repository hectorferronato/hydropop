# Production notification restoration — September 5, 2026

The user authorized the remaining production actions after reviewing the initial audit.

- Applied `20260905130000_adaptive_push_reminders.sql`. Linked migration history is synchronized, and production database lint passes. The CLI emitted a non-blocking migration-catalog cache warning; the migration itself completed and was verified.
- Regenerated Supabase types from the deployed schema.
- Committed and pushed release `0b8006d` through the existing main-branch Vercel integration. Vercel reported successful deployment, and `https://hydropop-lake.vercel.app/sw.js` serves `hydropop-shell-v2`.
- Enabled `pg_cron` and `pg_net`. Created exactly one active `hydropop-push-reminders` job on `*/15 * * * *`, pointing to the production internal worker.
- Reused the existing Vault worker secret and VAPID keys. No keys were rotated or exposed.
- Invoked the normal worker once through pg_net at **18:23:14 UTC / 2:23:14 PM Eastern**. It returned HTTP 200, with two evaluations, two enqueues, two processed outbox items, and two user-level accepted reminders in the same invocation.
- All three active subscriptions received push-service acceptance: two iOS subscriptions and one macOS subscription. Both users' daily counts advanced once, and neither had a pending outbox item afterward.
- The user confirmed a reminder appeared on the phone.

Release validation passed: lint, typecheck, 542 tests, production build, formatting check, diff check, production database lint, and browser tests (32 passed, one existing skip).

The initial [audit report](push-notification-audit.md) describes the pre-restoration state and implementation. This document records the subsequent authorized production changes.

## Notification-tap follow-up

The user reported that tapping the first reminder opened the app shell but left Today blank; reopening from the Home Screen loaded Today normally. Delivery was confirmed, but that first tap did not pass the navigation check.

The follow-up removes an unnecessary `router.replace` server navigation while consuming the deep link. It now cleans the URL using the supported native History API and keeps the Record Water chooser mounted. The service worker now navigates before focusing and falls back to opening a window if a suspended client cannot navigate; focus rejection no longer aborts navigation. Today also has a visible loading message and reload control.

These are concrete navigation fixes, not proof of the precise failure inside the physical phone. iOS has documented [suspended-client focus/navigation failures](https://bugs.webkit.org/show_bug.cgi?id=252544), and Next.js documents [native History API URL updates without navigation](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api).

Follow-up validation passed: 544 tests, 35 browser tests (including mobile WebKit deep-link cleanup with the chooser still visible and no hydration writes), lint, typecheck and production build. A fresh physical notification-tap check is still required after the phone receives the updated app/service worker.

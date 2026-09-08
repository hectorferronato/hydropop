# Frontend guide

[Documentation hub](README.md) · [Architecture](architecture.md) · [Testing](testing.md)

## Navigation and page responsibilities

| Route                     | What it does                                                                   | Key source                                              |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `/auth/login`             | Email/password sign-in; preserves a safe internal destination                  | [Auth routes](../app/auth)                              |
| `/setup`                  | Collects profile, schedule, goal and primary bottle; supports pilot activation | [Setup](<../app/(private)/setup>)                       |
| `/today`                  | Authoritative current-day intake, pace, full/half chooser and recordings       | [Today](<../app/(private)/today>)                       |
| `/calendar`               | Local-date history with the shared recording timeline                          | [Calendar](<../app/(private)/calendar>)                 |
| `/trends`                 | Server-projected 7/30/90-day analytics                                         | [Trends](<../app/(private)/trends>)                     |
| `/community`              | Consent/join flow and limited member directory                                 | [Community guide](community.md)                         |
| `/u/[username]`           | Private member summary; requires authorized access                             | [Member page](<../app/(private)/u/[username]/page.tsx>) |
| `/profile`                | Personal summary and access to settings/device tools                           | [Profile](<../app/(private)/profile>)                   |
| `/settings` and subroutes | Profile, hydration, bottle, Community and notification preferences             | [Settings](<../app/(private)/settings>)                 |
| `/device/nfc`             | Tag creation, assignment, friendly codes and revocation                        | [NFC UI](<../app/(private)/device/nfc>)                 |
| `/device/button`          | Button provisioning, assignment and credential revocation                      | [Button UI](<../app/(private)/device/button>)           |
| `/t/[identifier]`         | NFC entry, authentication/setup routing and explicit confirmation              | [NFC route](../app/t/[identifier])                      |
| `/offline`                | Offline navigation fallback                                                    | [Offline page](../app/offline/page.tsx)                 |

Today, Calendar, Trends, Community and Profile are primary navigation. Device
and Settings are reachable through Profile; desktop also provides secondary
navigation. The [AppShell](../components/app-shell.tsx) owns the responsive frame,
not the hydration calculations.

## Server/client split

Private pages verify identity server-side and project data before rendering.
Client components own interactions: dialogs, pending buttons, browser permission,
focus management, feedback and local presentation preferences. A `"use client"`
boundary must not import credentials or server-only infrastructure.

Prefer a server page that fetches and derives a serializable model, then passes
only the required fields into focused client components. Keep domain calculations
shared and server-authoritative; do not recalculate notification eligibility in
JavaScript on the phone.

Form submissions use either server actions (setup/settings/Community) or versioned
routes (recording and device management). The API table is not a complete list of
mutations: server actions independently verify access too.

## Recording and refresh

[RecordWater](<../app/(private)/today/record-water.tsx>) starts an explicit full/half
recording. Its request lock, pending state and retained idempotency key protect
against double taps and lost responses. Show success only after a successful
server result. Half and full are semantic actions; the server resolves volume.

The shared [EventTimeline](../components/hydration/event-timeline.tsx) and
[recording actions](../components/hydration/recording-actions.tsx) drive Today and
Calendar corrections. Keep keyboard operation, dialog focus/return, Escape and
narrow-screen layout intact when modifying them.

A successful hydration mutation revalidates Today, Calendar, Trends, Profile,
Community and member pages. The [Today refresh controller](../components/today-refresh-controller.tsx)
also polls every five seconds while visible and online and refreshes after
focus/visibility/local mutation. This lets a physical button update an open web
view without a separate client-side ledger. Do not add a second polling loop.

## Notification deep links

`/today?record=1&source=push` opens the Record Water chooser after the dashboard
loads. The consumed query string is removed with `history.replaceState`; that
cleanup must not launch a second server navigation or record hydration.

The service worker accepts only the same-origin Today targets defined in
[sw.js](../public/sw.js). It navigates an existing window before focusing it,
handles suspended-client failures, and can open a fresh window. See
[Notifications](notifications.md) for lifecycle and physical test limits.

## Loading, failure and accessibility

Use route `loading.tsx` and `error.tsx` boundaries where provided. An interrupted
Today render has a visible loading message and reload action; failed data reads
must not silently display a zero-intake day. Preserve accessible names, visible
pending/error feedback, disabled duplicate submissions, focus trapping and focus
return in modal flows.

Tailwind styling and design tokens live in [globals.css](../app/globals.css).
Use the existing components rather than adding a parallel navigation, modal or
feedback system. Prefer semantic HTML; test at 320 px width, portrait/landscape,
and with keyboard navigation.

## Feedback and PWA scope

Hydration celebration/sound behavior is in
[application/celebration](../lib/application/celebration) and shared UI components.
Feedback follows a confirmed action and existing user preferences; it must not
become evidence that a failed write succeeded.

[PwaServiceWorker](../components/pwa-service-worker.tsx) registers one root-scoped
worker with `updateViaCache: "none"`. The manifest and icon metadata live in
[manifest.ts](../app/manifest.ts) and [layout.tsx](../app/layout.tsx). Offline
navigation falls back to `/offline`; the app does not cache private hydration
responses or implement an offline recording queue.

## Making a UI change

1. Identify its server page, client interaction component and contract.
2. Reuse the existing application use case and authoritative projections.
3. Include loading, denied/missing configuration, empty and failure states.
4. Preserve no-write-on-navigation behavior and idempotent retries.
5. Run [appropriate browser tests](testing.md), including mobile WebKit for PWA/NFC
   or notification-entry changes. Emulation does not establish OS notification delivery.

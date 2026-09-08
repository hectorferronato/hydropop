# API reference

[Documentation hub](README.md) · [Backend](backend.md) · [Physical button contract](physical-buttons.md)

## Authentication and response conventions

**Session** means a verified Supabase cookie session plus the deployment's email
allowlist. Call these routes from the authenticated app; never supply a user ID
as proof of identity. **Device bearer** is a dedicated physical-button token.
**Worker bearer** is the independent server scheduler secret. They are not interchangeable.

Most session APIs return one of:

```json
{ "data": { "example": "resource-specific payload" }, "error": null }
```

```json
{
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Review the request and try again."
  }
}
```

Physical-device responses, the public health route and worker counters have
separate shapes. Read the actual response contract; do not assume all routes use
the envelope. Request schemas generally reject unknown fields where `.strict()`
is specified, but not every older schema is strict. Send only documented fields.

## HTTP route inventory

Bracket segments are path parameters, not literal URLs. Links point directly to
the handler implementing each method.

| Method       | Route / source                                                                                | Authentication | Purpose                                                                   |
| ------------ | --------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| POST         | [`/api/internal/push-reminders/run`](../app/api/internal/push-reminders/run/route.ts)         | Worker bearer  | Evaluate/enqueue/claim/send; aggregate counters, not the browser envelope |
| GET, POST    | [`/api/v1/bottles`](../app/api/v1/bottles/route.ts)                                           | Session        | List or create owned bottles                                              |
| GET          | [`/api/v1/calendar`](../app/api/v1/calendar/route.ts)                                         | Session        | Month summary; `month=YYYY-MM`                                            |
| GET          | [`/api/v1/dashboard/today`](../app/api/v1/dashboard/today/route.ts)                           | Session        | Authoritative current-day dashboard                                       |
| POST         | [`/api/v1/device/hydration`](../app/api/v1/device/hydration/route.ts)                         | Device bearer  | Intentional completion; compact firmware response                         |
| GET          | [`/api/v1/device/status`](../app/api/v1/device/status/route.ts)                               | Device bearer  | Read-only authoritative status; compact firmware response                 |
| GET          | [`/api/v1/health`](../app/api/v1/health/route.ts)                                             | Public         | `{status:"ok",service:"hydropop"}` only; no DB/auth probe                 |
| POST         | [`/api/v1/hydration-events/change`](../app/api/v1/hydration-events/change/route.ts)           | Session        | Edit/remove an owned effective recording                                  |
| POST         | [`/api/v1/hydration-events/manual`](../app/api/v1/hydration-events/manual/route.ts)           | Session        | Full/half using current primary bottle                                    |
| POST         | [`/api/v1/hydration-events`](../app/api/v1/hydration-events/route.ts)                         | Session        | Lower-level validated event processor                                     |
| POST         | [`/api/v1/nfc-tags/[id]/revoke`](../app/api/v1/nfc-tags/[id]/revoke/route.ts)                 | Session        | Revoke the owned tag                                                      |
| POST         | [`/api/v1/nfc-tags/[id]/rotate`](../app/api/v1/nfc-tags/[id]/rotate/route.ts)                 | Session        | Issue a new secure locator for the owned tag                              |
| PUT          | [`/api/v1/nfc-tags/[id]`](../app/api/v1/nfc-tags/[id]/route.ts)                               | Session        | Update label, friendly code and bottle assignment                         |
| POST         | [`/api/v1/nfc-tags/complete`](../app/api/v1/nfc-tags/complete/route.ts)                       | Session        | Resolve identifier and confirm full/half                                  |
| POST         | [`/api/v1/nfc-tags/pilot/activate`](../app/api/v1/nfc-tags/pilot/activate/route.ts)           | Session        | Explicit owner pilot-tag activation                                       |
| GET, POST    | [`/api/v1/nfc-tags`](../app/api/v1/nfc-tags/route.ts)                                         | Session        | List or create owner tags                                                 |
| PUT          | [`/api/v1/notification-preferences`](../app/api/v1/notification-preferences/route.ts)         | Session        | Overall opt-in and optional bounded frequency                             |
| POST         | [`/api/v1/physical-devices/[id]/revoke`](../app/api/v1/physical-devices/[id]/revoke/route.ts) | Session        | Revoke an owned button credential                                         |
| PATCH        | [`/api/v1/physical-devices/[id]`](../app/api/v1/physical-devices/[id]/route.ts)               | Session        | Update owned button label and bottle assignment                           |
| GET, POST    | [`/api/v1/physical-devices`](../app/api/v1/physical-devices/route.ts)                         | Session        | List or create buttons; creation issues token once                        |
| POST         | [`/api/v1/push-notifications/test`](../app/api/v1/push-notifications/test/route.ts)           | Session        | Send test only to current registered endpoint                             |
| POST, DELETE | [`/api/v1/push-subscriptions`](../app/api/v1/push-subscriptions/route.ts)                     | Session        | Register/reconcile or revoke current endpoint                             |
| POST         | [`/api/v1/push-subscriptions/status`](../app/api/v1/push-subscriptions/status/route.ts)       | Session        | Read-only POST checks own endpoint registration without URL leakage       |
| GET, PUT     | [`/api/v1/settings`](../app/api/v1/settings/route.ts)                                         | Session        | Read setup snapshot or update profile preference fields                   |

Setup, profile/bottle/hydration settings forms and Community also use server
actions. They are not undocumented REST endpoints. See their action modules under
[private routes](<../app/(private)>) and the dedicated guides.

## Common request examples

Examples use synthetic data and are not commands to write production hydration.
Use current valid timestamps and a fresh key for a new action on a development
account; reuse that same payload/key when retrying it.

### Web full/half recording

`POST /api/v1/hydration-events/manual`

```json
{
  "action": "half",
  "idempotencyKey": "example-web-action-0001",
  "occurredAt": "2026-09-08T16:00:00.000Z"
}
```

The server chooses the primary bottle and amount. Full creates a completion;
half creates manual intake. See [manual-hydration.ts](../lib/contracts/manual-hydration.ts).

### NFC confirmation

`POST /api/v1/nfc-tags/complete`

```json
{
  "identifier": "pilot",
  "action": "full",
  "confirmRecent": false,
  "idempotencyKey": "example-nfc-action-0001",
  "occurredAt": "2026-09-08T16:00:00.000Z"
}
```

`action` defaults to `full`; `confirmRecent` defaults to false. This flag is set
only after deliberate rapid-repeat confirmation. Identity, bottle and volume
are derived on the server. See [NFC contract](../lib/contracts/nfc.ts).

### Recording correction

`POST /api/v1/hydration-events/change`

```json
{
  "action": "edit",
  "eventId": "11111111-1111-4111-8111-111111111111",
  "idempotencyKey": "22222222-2222-4222-8222-222222222222",
  "amount": 500,
  "unit": "ml",
  "date": "2026-09-08",
  "time": "12:00:00"
}
```

These UUIDs are illustrative; a real correction must reference the caller's
owned effective event. `date`/`time` are interpreted in the member timezone.
For removal, send only `action:"remove"`, `eventId` and `idempotencyKey`.
See [correction contract](../lib/contracts/change-hydration-recording.ts).

### Reminder preferences

`PUT /api/v1/notification-preferences`

```json
{ "paceRemindersEnabled": true, "reminderFrequency": "balanced" }
```

`paceRemindersEnabled` is required; frequency is optional and, when omitted,
preserves an existing preference. Valid values: `gentle`, `balanced`, `frequent`.
This does not create a PushSubscription. See [push contract](../lib/contracts/push-notifications.ts).

### Lower-level event API

`POST /api/v1/hydration-events` uses `bottleId`, `eventType`, `source`,
`occurredAt`, `idempotencyKey` and event-specific optional fields. Completion
must not supply volume; manual intake requires positive `volumeMl`, adjustment
requires nonzero signed volume, and reversal requires `reversesEventId`.
`source:"device"` is excluded from this ordinary client contract. Hardware must
use its dedicated endpoint. The exact schema is
[hydration-events.ts](../lib/contracts/hydration-events.ts).

### Physical device requests

See [Physical buttons](physical-buttons.md) for bearer authentication, strict
body/key rules, UTC timestamp requirements, unwrapped version-1 responses and
retry handling. A device never submits an account ID, bottle ID, volume or goal.

## Other request contracts

| Resource                                                      | Source                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| Bottle creation                                               | [bottles.ts](../lib/contracts/bottles.ts)                       |
| Profile-only settings API                                     | [settings-api.ts](../lib/contracts/settings-api.ts)             |
| Setup and form-based goal/bottle changes                      | [setup.ts](../lib/contracts/setup.ts)                           |
| NFC management and completion                                 | [nfc.ts](../lib/contracts/nfc.ts)                               |
| Physical-button management                                    | [physical-device.ts](../lib/contracts/physical-device.ts)       |
| Push subscription keys/endpoint and current-device operations | [push-notifications.ts](../lib/contracts/push-notifications.ts) |
| Community server-action inputs and RPC outputs                | [community.ts](../lib/contracts/community.ts)                   |

`PUT /api/v1/settings` updates profile preference fields; it is not a generic replacement
for the goal/bottle settings actions. Be explicit about which persisted field a
UI control changes, especially profile target time versus a date-effective goal target.

## Status codes and retries

For session APIs, common statuses are 400 invalid input, 401 unauthenticated,
403 disallowed account, 404 unavailable resource, 409 configuration/conflict,
422 invalid event window/reversal, 500 internal/write failure, and 503 push
configuration failure. The exhaustive mapping lives in
[api-route.ts](../lib/application/http/api-route.ts).

Do not infer a failed write solely from a network timeout. Retry a write with its
original idempotency key. Do not retry 400/401/403/configuration errors indefinitely.
There is no generic published rate-limit or Retry-After contract; add and document
one explicitly if required rather than assuming it exists.

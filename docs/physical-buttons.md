# Physical button backend integration

[Documentation hub](README.md) · [API reference](api-reference.md) · [Security](security.md)

The Phase 3A backend reuses `devices` for `physical_button` records. Each button
belongs to the authenticated creator, is assigned to one owned non-archived
bottle, and has one 256-bit random base64url credential. Creation returns the
raw credential once; only its lowercase SHA-256 digest is persisted. The
credential cannot be read, rotated, or reactivated. Revocation preserves device
and hydration history while immediately rejecting future device requests.

Private management is available at `/device/button`. Browser requests may
submit only the label and bottle ID; the server derives the owner from the
verified Supabase session. The credential digest is excluded from direct table
grants and from every management response.

The physical button talks only to these Next.js HTTPS endpoints:

- `POST /api/v1/device/hydration`
- `GET /api/v1/device/status`

Both require `Authorization: Bearer <DEVICE_TOKEN>`. The POST body is strictly:

```json
{
  "action": "bottle_completed",
  "idempotencyKey": "device-generated-event-key",
  "occurredAt": "2026-09-04T16:00:00.000Z"
}
```

`occurredAt` is optional. When omitted, Next.js supplies its actual server
receipt time. A supplied time must be UTC, no more than five minutes ahead, and
no more than seven days old. The button never submits an owner, bottle, volume,
goal, source, or arbitrary event type.

Firmware resolves press duration and cancellation before making a request. The
backend never receives or interprets hold duration: a short status gesture uses
GET and cannot write hydration, while only an already-resolved intentional
completion sends the POST above.

The database scopes each request key to the authenticated physical-device ID
before calling the existing atomic `process_hydration_event` function. A lost
response can therefore be retried safely: the first response says `created`, a
replay says `existing`, and both refer to the same immutable event semantics.
The authoritative processor resolves `typical_fill_ml ?? capacity_ml`, records
source `device`, and keeps existing reversal and completed-bottle behavior.
Next.js also authenticates to these two public-key database RPCs with the
independent `PHYSICAL_DEVICE_RPC_SECRET` stored in Supabase Vault. This prevents
a stored device digest from becoming a reusable direct-Supabase credential.
Use `supabase/templates/physical-device-rpc-secret.sql.example` as the safe
pre-deployment template; never place the real value in the repository.

Success responses are unwrapped, compact version-1 JSON for firmware. They
contain milliliter totals, the user's display unit, goal progress, pace status,
pace delta, a `none`/`half`/`full` recommendation, server time, and the assigned
bottle's normal completion amount. POST additionally returns `recordedMl` and
`result`. No response includes account identifiers, bottle identifiers, NFC or
Community data, history, or credentials. Status GET is read-only; successful
POST is the only device operation that updates last-seen/sync metadata.

Pace output is calculated in TypeScript by the same deterministic coaching
functions used by Today and the Web Push reminder policy. Device hydration does
not enqueue a push notification; later reminder evaluation naturally reads the
new immutable event. A newly created event calls the same centralized hydration
view revalidation as manual and NFC recording.

## Firmware versus backend ownership

| Firmware owns (separate repository)                             | This repository owns                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Electrical design, GPIO and LED behavior                        | Credential registration, hashing and revocation                     |
| Press/hold/cancel interpretation                                | Validation of an already-intentional completion                     |
| Wi-Fi provisioning and local credential storage                 | HTTPS request authentication and safe responses                     |
| Durable queue/retry scheduling and stable event keys            | Device-scoped deduplication and immutable event processing          |
| Clock acquisition and deciding whether a timestamp is available | Seven-day/five-minute timestamp validation and server-time fallback |

This guide documents the interface, not the actual firmware implementation.
No pin map, LED protocol, long-press threshold or offline queue guarantee is
inferred from the backend. The generic source enum also contains historical
values; only the dedicated device boundary creates physical-button `device` events.

## Provision a button

1. Configure `PHYSICAL_DEVICE_RPC_SECRET` on the server and the matching Vault
   entry using the reviewed [template](../supabase/templates/physical-device-rpc-secret.sql.example).
   This server secret never goes to the device.
2. Sign in, open `/device/button`, choose an owned active bottle and label.
3. Transfer the one-time device token securely into the intended firmware configuration.
4. Request status first. It must not increment intake or update last-seen metadata.
5. Send one intentional completion on a development account. A new event returns
   HTTP 201 / `created`; replaying its key returns HTTP 200 / `existing`.
6. Revoke the registration and verify both endpoints return 401. A replacement
   requires new registration; the API has no token-rotation/reactivation endpoint.

A button can be assigned to an owned non-archived bottle; it does not rely on the
NFC scanner's primary-bottle lookup. Do not blindly substitute the web/NFC
recording contract when implementing hardware.

## Compact response example

Illustrative POST success; numbers are examples, not a production record:

```json
{
  "version": 1,
  "serverTime": "2026-09-08T16:00:00.000Z",
  "unit": "ml",
  "todayMl": 700,
  "goalMl": 2400,
  "progressPercent": 29,
  "goalComplete": false,
  "paceStatus": "on_track",
  "paceDeltaMl": -100,
  "recommendedAction": "none",
  "normalCompletionMl": 700,
  "recordedMl": 700,
  "result": "created"
}
```

Status GET has the same status fields without `recordedMl` and `result`. These
responses are **not** wrapped in `{data,error}`. `paceDeltaMl` is actual minus
expected intake; negative means below expected. All numeric volumes remain ml
even when `unit` is `oz`. `progressPercent` may exceed 100.

The key must match `^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$` (8–128 characters).
The hydration JSON body is limited to 2,048 bytes and rejects unknown fields.
Preserve the key and occurrence timestamp for a retry; do not create a new action
because a response was lost. The API is not a command stream for press duration.

## Error handling

| HTTP | Code                               | Integration response                                                               |
| ---- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| 400  | `INVALID_INPUT`                    | Correct the payload/key; do not retry malformed requests forever                   |
| 401  | `UNAUTHORIZED`                     | Check token provisioning/revocation; no credential reset in firmware               |
| 409  | `DEVICE_CONFIGURATION_ERROR`       | Owner/admin checks active assigned bottle and hydration configuration              |
| 422  | `EVENT_IN_FUTURE`, `EVENT_TOO_OLD` | Check capture clock/window; do not silently rewrite known historical capture times |
| 500  | `INTERNAL_ERROR`                   | Preserve the request key; retry transient failures with bounded backoff            |

Errors include `version`, `serverTime` and `error: {code,message}`. The contract
does not expose internal account/bottle IDs or credentials.

## Source and verification map

[Physical-device contracts](../lib/contracts/physical-device.ts),
[device route handlers](../app/api/v1/device),
[status builder](../lib/application/device/build-device-status.ts), and
[database migration](../supabase/migrations/20260904120000_add_physical_button_backend.sql)
are the source of truth. Tests under [unit](../tests/unit) and
[integration](../tests/integration) cover credentials, request validation,
read-only status, deduplication, source isolation and status projection.

Verify real hardware separately: one completion creates one event, lost-response
replay does not duplicate it, status creates none, revoke blocks both requests,
and a later bottle-size edit does not alter the recorded snapshot volume.

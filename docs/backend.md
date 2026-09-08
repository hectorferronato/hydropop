# Backend and database guide

[Documentation hub](README.md) · [API reference](api-reference.md) · [Security](security.md)

## Runtime boundaries

Next.js route handlers and server actions orchestrate Supabase operations. The
private layout is not sufficient authorization for an API: each handler/action
must enforce its own authentication path. Most browser resources use
[getAllowedUser](../lib/infrastructure/supabase/auth.ts), safe request parsing and
the stable [API envelope](../lib/contracts/api-response.ts).

Supabase client factories have distinct purposes. Session-aware browser/server
clients are in [infrastructure/supabase](../lib/infrastructure/supabase).
The push worker client has no persisted user session. Physical-device adapters
hash the hardware token and use the independent server/Vault secret. Do not
replace either with a service-role client or expose a worker RPC directly to UI code.

## Persistence map

| Table(s)                                                | Purpose                                                       | Important boundary                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `profiles`                                              | Display name, units, IANA timezone and schedule               | Auth-owned profile; server allowlist additionally controls app access  |
| `bottles`                                               | Capacity, typical fill, primary/archived state                | Snapshot volume into events; later bottle edits do not rewrite history |
| `hydration_goals`                                       | Date-effective goal and target time                           | Preserve historical goal semantics                                     |
| `hydration_events`                                      | Immutable hydration, reversal and correction history          | Ownership, idempotency and lineage constraints                         |
| `nfc_tags`                                              | Active/revoked tag, hashed locator and bottle assignment      | Owner-scoped lookup; raw locator only issued once                      |
| `nfc_friendly_code_reservations`                        | Prevent friendly-code reuse for another tag                   | Reservation survives rename/revocation                                 |
| `devices`                                               | Physical-button registration and assigned bottle              | Credential digest excluded from ordinary management access             |
| `community_profiles`, `community_username_reservations` | Consented identity, visibility and reserved names             | Restricted member views; no public event access                        |
| `web_push_subscriptions`                                | Per-browser endpoint and encryption keys                      | Private credential-bearing rows; safe metadata only in UI              |
| `hydration_notification_preferences`                    | Opt-in and bounded reminder frequency                         | Owner-managed preferences                                              |
| `hydration_reminder_state`                              | Daily count, episode, lease, diagnostics and pending delivery | Server-only table; owner metadata via dedicated RPC                    |
| `push_notification_outbox`                              | Idempotent user-level reminder and delivery/retry state       | Server-only, tokenized claims and bounded retries                      |

[database.types.ts](../lib/infrastructure/supabase/database.types.ts) is generated
from the linked schema. Migrations are the executable history; inspect the latest
replacement of a function to understand current behavior.

## Important transactional entry points

| Function family                                      | Responsibility                                           | Source migration                                                                                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `save_onboarding`, `activate_pilot_nfc_tag`          | Atomic setup and owner pilot-tag activation              | [Near-zero setup](../supabase/migrations/20260802120000_add_near_zero_setup_pilot_activation.sql)                                                                                |
| `process_hydration_event`                            | Validate and deduplicate immutable event insertion       | [Current physical-device boundary update](../supabase/migrations/20260904120000_add_physical_button_backend.sql)                                                                 |
| `change_hydration_recording`                         | Atomic reversal and optional replacement                 | [Recording corrections](../supabase/migrations/20260905120000_add_immutable_recording_edits.sql)                                                                                 |
| NFC create/update/rotate/revoke functions            | Owner-scoped credential and code lifecycle               | [Secure management](../supabase/migrations/20260728140000_add_secure_nfc_tag_management.sql), [friendly codes](../supabase/migrations/20260729120000_add_nfc_friendly_codes.sql) |
| Physical-button management and status/hydration RPCs | Separate owner-management and hardware credential paths  | [Physical button backend](../supabase/migrations/20260904120000_add_physical_button_backend.sql)                                                                                 |
| Community profile/directory/member RPCs              | Consent, reservation and limited cross-member aggregates | [Private Community](../supabase/migrations/20260730120000_add_private_community_pilot.sql)                                                                                       |
| Reminder claim/apply/claim-outbox/complete RPCs      | Evaluation leases, dedupe, retry and accepted counts     | [Adaptive reminders](../supabase/migrations/20260905130000_adaptive_push_reminders.sql)                                                                                          |

The names in a function family row summarize related operations; consult the
linked migration for exact signatures, grants and argument defaults.

## Transactions, retries and failures

Use existing RPCs for multi-row invariants. A client-side sequence of ordinary
inserts cannot replace atomic onboarding, event processing or recording edits.
Keep stable idempotency keys through retries and check whether the returned result
is a new event or a replay before triggering mutation-specific effects.

A successful database write and a lost HTTP response are different from a failed
write. Retry the same logical request, not a new key. Similarly, a push provider
may accept a message before the worker crashes; database claims are idempotent,
but external delivery cannot be promised exactly once.

Safe application errors map to HTTP status codes in
[api-route.ts](../lib/application/http/api-route.ts). Physical firmware has its own
[compact response/error mapping](../lib/application/device/device-api-response.ts).
Never return raw SQL messages, exception objects or credential-bearing rows.

## Working on the schema

1. Read the affected migration chain, RLS policies, grants and generated types.
2. Add a forward-only migration with a unique timestamp; never rewrite deployed migrations.
3. Preserve `timestamptz`, integer ml, immutable rows and composite ownership constraints.
4. Exercise meaningful RPC behavior in embedded PostgreSQL tests. Static source
   assertions do not replace runtime SQL coverage.
5. Review linked migration applicability with `--dry-run`; it lists pending files,
   it does not execute their SQL.
6. Apply to the intended environment deliberately; regenerate types afterward.
   Existing RPC nullability adapters are documented in source and should remain narrow.

See [Operations](operations.md) for database-first releases and
[Security](security.md) for SECURITY DEFINER review criteria.

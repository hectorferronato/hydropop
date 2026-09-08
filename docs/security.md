# Security and privacy boundaries

[Documentation hub](README.md) · [Backend](backend.md) · [Operations](operations.md)

## Identity is not client input

Browser identity comes from verified Supabase claims plus a fresh user lookup,
then the server-only allowlist. The root proxy refreshes sessions and performs
optimistic redirects; handlers/actions and private layouts verify independently.
Supabase RLS remains the data boundary even when the UI hides a control.

The app allowlist is an application check, not a substitute for database grants
or RLS. Review direct RPC/table access independently when adding functionality.
Physical-device and worker requests use separate non-session authentication paths
and must not inherit trust from a client-supplied owner, source or bottle ID.

## Credential inventory

| Credential                      | Holder                                   | Stored form / use                                                                 |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Supabase publishable key        | Browser/server                           | Public project configuration; not privileged database access                      |
| Browser Auth session            | Cookie-backed SSR session                | Verified on protected requests                                                    |
| NFC secure locator              | Issued URL holder                        | Only SHA-256 digest persisted; resolution still requires authenticated ownership  |
| NFC friendly code               | User-visible URL                         | Non-secret; owner-scoped and permanently reserved per user                        |
| Physical button token           | One provisioned device                   | 32 random bytes / 43 base64url characters; only digest persisted                  |
| Physical-device RPC secret      | Next.js server and Vault                 | Independent server boundary; never sent to firmware                               |
| Push worker secret              | Next.js server and Vault                 | Scheduler/worker authentication; never sent to browser                            |
| VAPID private key               | Push server                              | Existing matching public/private pair; rotation is not a troubleshooting shortcut |
| Push endpoint + encryption keys | Browser subscription and private backend | Never include in diagnostics, logs or shared artifacts                            |

NFC secure URLs and physical-device tokens are different credential types even
though both use a 43-character random-token representation. Never exchange them.

## RLS and function privileges

Owner-managed tables retain RLS. Reminder state/outbox remain server-only.
Community exposes approved aggregates through guarded functions, not another
member's private event rows. SECURITY DEFINER functions must have a narrow
purpose, explicit caller authorization, constrained input/output, an empty search
path and deliberate EXECUTE grants. Inspect the latest migration's actual security
mode; do not assume all functions are invoker or all functions bypass RLS alike.

No application path uses a service-role key. The worker's anon EXECUTE grants
are only useful with the secret check inside the function; do not add anon table
grants to fix a permission error. Status endpoints and navigation GETs must remain
free of hydration writes.

## Safe diagnostics

Log safe codes and operation names. Existing
[safe-database-diagnostic.ts](../lib/infrastructure/supabase/safe-database-diagnostic.ts)
redacts suspect credential-bearing details. Do not log request bodies, full push
errors, headers, bearer tokens, Vault decrypted rows or subscription endpoints.
Select metadata columns explicitly; `select *` is inappropriate for shared support output.

The notification diagnostic RPC returns only the signed-in user's safe observation
fields. Push-service acceptance is not evidence of lock-screen display. Production
status reports should name what was observed and when without copying customer data.

## Provisioning and revocation

Use the existing UI and RPC lifecycle. Raw credentials are shown once; store them
in the intended device/configuration without committing them. Revoke lost physical
credentials; create a new registration for replacement rather than editing a digest
or reactivating a revoked row. NFC rotation, friendly-code changes and revocation
have different effects; follow [the lifecycle table](nfc.md#identifier-lifecycle).

For an actual secret exposure, stop the affected credential's use and plan a
coordinated replacement across its holders. Preserve unrelated credentials and
immutable history. Never paste the exposed value into the incident record.

## Reporting a security issue

Use a private maintainer channel for vulnerability details. Include affected
paths, safe reproduction steps, expected/observed authorization and impact. Use
synthetic identifiers and redacted payloads. Do not publish working tokens or
customer history in a public issue.

# HydroPOP documentation

These guides describe the code in this repository as reviewed on September 8, 2026. Source links identify the implementation behind each contract. Live
production health must be checked separately; dated incident reports are historical.

## Choose a starting point

| Your task                           | Start here                              | Then read                                                   |
| ----------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| Run the application                 | [Getting started](getting-started.md)   | [Testing](testing.md)                                       |
| Understand the system               | [Architecture](architecture.md)         | [Hydration rules](hydration.md)                             |
| Change screens or interactions      | [Frontend](frontend.md)                 | [API reference](api-reference.md)                           |
| Change persistence or authorization | [Backend](backend.md)                   | [Security](security.md)                                     |
| Provision or debug a tag            | [NFC](nfc.md)                           | [Troubleshooting](operations.md#troubleshooting)            |
| Integrate a physical button         | [Physical buttons](physical-buttons.md) | [API reference](api-reference.md)                           |
| Diagnose missing reminders          | [Notifications](notifications.md)       | [Operational checks](operations.md#read-only-health-checks) |
| Work on Community                   | [Community](community.md)               | [Security](security.md)                                     |
| Release or recover a deployment     | [Operations](operations.md)             | [Testing](testing.md)                                       |
| Submit a change                     | [Contributing](../CONTRIBUTING.md)      | Relevant feature guide                                      |

## Terminology

- **Normal fill**: `typical_fill_ml ?? capacity_ml`, resolved and snapshotted when a bottle is completed.
- **Effective history**: immutable events after excluding reversed originals and reversal audit rows.
- **Hydration day**: a calendar date in a member's IANA timezone, not the server's UTC date.
- **Completion**: a deliberate action after finishing a normal bottle; it does not require a prior fill event.
- **Primary bottle**: the active bottle used by the normal web/NFC recording flows. A physical button has its own explicit bottle assignment.
- **Acceptance**: a push provider accepted the message. This does not prove OS display or a notification tap.
- **RPC**: a PostgreSQL function called through Supabase; authorization depends on that function's grants and implementation.

## Source-level guides

[Application use cases](../lib/application/README.md),
[hydration projection](../lib/domain/hydration/README.md),
[coaching](../lib/domain/coaching/README.md),
[contracts](../lib/contracts/README.md), and [units](../lib/units/README.md)
provide navigation near the code.

## Historical reports

- [September 5 Web Push audit](push-notification-audit.md): original findings, code changes and pre-restoration evidence.
- [Production restoration record](push-production-restoration.md): deployment and phone-tap follow-up; read alongside the [current notification guide](notifications.md) for the later scheduled-run verification.
- [Recording edit/removal handoff](recording-edit-removal-handoff.md): implementation and validation context for immutable corrections.

## Keeping this documentation accurate

Update a guide in the same change as its behavior or contract. Route methods and
field names come from handlers/Zod schemas; schema claims come from the latest
migration that defines a function, not just its first migration. Do not paste
secrets or customer records into examples. Label examples, historical evidence,
and unverified hardware behavior explicitly. See [Contributing](../CONTRIBUTING.md).

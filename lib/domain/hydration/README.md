# Hydration domain

[Documentation hub](../../../docs/README.md) · [Product rules](../../../docs/hydration.md)

This directory contains framework-free immutable event projection:

- event and source types
- authoritative credited-volume rules
- effective-history and reversal reconstruction
- normal bottle-completion projection plus legacy bottle-cycle compatibility
- daily summaries and goal-reached time
- streak calculation
- IANA-local date and DST-aware schedule utilities
- the seven-day offline and five-minute future event window

Reversals are audit rows. The original and reversal remain in audit history, but the
original no longer contributes intake or a cycle transition. The reversal is
also excluded from `effectiveEvents` and carries zero projected credit. The raw
credited-volume helper can describe its negative ledger meaning, but daily and
cycle projections never subtract that value after excluding the original.

## Deterministic reversal states

| Immutable history                                                   | Effective cycle after reversal             | Effective intake            |
| ------------------------------------------------------------------- | ------------------------------------------ | --------------------------- |
| `fill_started → refill → reverse fill_started`                      | Active at the refill; one completed bottle | One refill capacity         |
| `fill_started → refill A → refill B → reverse refill A`             | Active at refill B; one completed bottle   | Refill B capacity           |
| `fill_started → refill → bottle_finished → reverse bottle_finished` | Active at the refill; one completed bottle | One refill capacity         |
| `adjustment → reverse adjustment`                                   | Unchanged/inactive                         | Zero from that adjustment   |
| `manual_intake → reverse manual_intake`                             | Unchanged/inactive                         | Zero from that manual entry |

The database rejects reversal of an existing reversal, a second reversal of the
same original, and an original not visible to `auth.uid()`.

## Normal completion gesture

New product activity records `bottle_completed` with the effective normal fill
already snapshotted into `volume_ml`. It counts as one completed bottle, needs
no prior cycle event, and does not change legacy cycle state. Reversing it
removes both its effective intake and completed-bottle count. Legacy fill,
refill, and finish rows remain readable so old and mixed histories continue to
project deterministically.

NFC does not add a second hydration model. An authenticated NFC confirmation
adapts a secure tag lookup into the same `bottle_completed` processor call with
source `nfc`. Intentional physical-button completion requests map to the same event; short status requests are read-only. Page loads
are read-only; only explicit POST actions can append immutable hydration
events.

## User recording corrections

`change_hydration_recording` atomically reverses an owned effective event and,
for edits, inserts its replacement. The immutable `corrects_event_id` points to
the previous version. Each replacement retains source, semantic type, bottle
and device from that version. Repeated edits form a chain; removal reverses the
active leaf. No delta or second history system is needed.

`effectiveRecordingHistory` filters the reconstructed timeline for the shared
Today/Calendar component. `recordingSourceLabel` reads the immutable source and
explicit lineage, never client metadata. Normal history hides reversal and
superseded rows. The full timeline remains available to audit/domain consumers.

Recording edits have a separate window from offline capture: no future times,
a maximum ten-year history, and an active historical goal on the corrected day.
Amount is converted from ml/oz server-side and bounded to 1–10,000 integer ml.
The SQL RPC repeats validation. Local inputs use the member timezone; nonexistent
DST times are rejected and unchanged repeated-hour timestamps are preserved.

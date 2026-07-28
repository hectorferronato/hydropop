# Hydration domain

This directory contains framework-free immutable event projection:

- event and source types
- authoritative credited-volume rules
- effective-history and reversal reconstruction
- bottle-cycle state
- daily summaries and goal-reached time
- streak calculation
- IANA-local date and DST-aware schedule utilities
- the seven-day offline and five-minute future event window

Reversals are audit rows. The original and reversal remain visible, but the
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

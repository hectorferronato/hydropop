# Recording editing and removal handoff

Implemented in the existing HydroPOP repository. The authorized migration
`20260905120000_add_immutable_recording_edits.sql` is now applied to the linked
Supabase project. Generated types have been refreshed and the migration-specific
type overlays removed. This release includes those changes and the original
recording feature. Firmware, device tokens, NFC URLs, push secrets and Cron
configuration are unchanged. No Docker, local Supabase or seed data was used.
Database test fixtures run only inside ephemeral in-memory PostgreSQL (PGlite).

1. **Existing model.** Hydration rows are immutable. `event_reversed` references
   `reverses_event_id`; a unique index permits one reversal per original. Signed
   adjustments exist, but there was no atomic replacement operation or explicit
   supersession link. TypeScript reconstruction and Community/reminder SQL
   already exclude reversed originals.
2. **Remove.** One authenticated POST calls one database transaction, inserting
   an audit reversal. No UPDATE or DELETE of hydration rows is performed.
   Same-key retries return the prior result; stale/different-key removals return
   a conflict without inserting another reversal.
3. **Edit.** One transaction inserts the reversal and a corrected replacement.
   An insertion failure rolls back both. Existing recording endpoints remain
   unchanged.
4. **Lineage.** Nullable `corrects_event_id` points to the preceding version,
   with an owner-composite foreign key and unique index. Repeated edits form an
   immutable chain. Original metadata remains on original rows; provenance does
   not depend on metadata.
5. **Bottle count.** Replacement rows inherit `event_type`, bottle, device and
   source from the owner’s prior effective row. Correcting an 887 mL
   `bottle_completed` event to 800 mL still contributes one completed bottle.
6. **Effective history.** `effectiveRecordingHistory` filters the existing
   reconstructed timeline. Today and Calendar share it through `EventTimeline`.
   Reversal and superseded rows remain available in audit history but are hidden
   from normal history. Totals continue using the existing shared domain and SQL
   projections.
7. **Source attribution.** `recordingSourceLabel` uses immutable source plus
   explicit lineage. The browser cannot set source, semantic type, ownership,
   bottle, device or metadata through the correction contract.
8. **Labels.** `web`: App; `nfc`: NFC; `device`: Physical button; `simulator`:
   Simulator; `mobile`: Mobile app; `charm`: Charm; `admin`: Administrator.
9. **Edited labels.** Any replacement adds “ · Edited” to its original-source
   label, including after multiple edits. The reversal’s web source separately
   records the correction method.
10. **Today.** Active recordings show volume, local time, source and a keyboard
    accessible overflow menu. Successful changes refresh the page and invalidate
    every existing hydration view.
11. **Calendar.** The selected day uses the same list/actions. Time edits move
    intake and bottle counts across member-local days. Headings now say
    “Recordings”; calendar copy avoids internal audit terminology.
12. **Edit UI.** Amount, date and time only. Initial units follow the member’s
    preference. Server helpers convert oz/ml to integer mL, bounded to 1–10,000.
    Date/time is interpreted in the member’s IANA timezone; nonexistent DST
    times, invalid values and future timestamps are rejected. Unchanged repeated
    DST-hour timestamps retain their original instant. Changed ambiguous local
    times use the existing timezone helper’s deterministic occurrence. SQL also
    requires a historical goal on the corrected day and a maximum ten-year age.
    Legacy zero-volume fill-start rows support removal only. Other legacy intake
    types preserve their semantic type when edited.
13. **Remove UI.** A separate confirmation names amount, time and source and
    explains recalculation. Native modal isolation plus explicit Tab wrapping,
    Escape, focus restoration, touch-sized targets, pending locks and error
    messages are implemented. Uncertain retries retain the operation key and
    freeze edited fields until the outcome is known. Successful removal focuses
    the history container before refresh.
14. **Security.** The route authenticates the allowlisted member; SQL derives
    `auth.uid()` and verifies ownership/effectiveness. The narrow security-definer
    function is needed to preserve device source and corrected completion
    snapshots; it accepts no protected semantics. Public/anonymous execution is
    revoked, search paths are empty, lineage cannot be inserted by authenticated
    clients, existing RLS remains enabled and ordinary source restrictions remain
    intact. The existing bottle advisory lock plus row lock and unique reversal
    index serialize changes. No service-role client/key was added.
15. **Migration.** Only the forward migration
    `supabase/migrations/20260905120000_add_immutable_recording_edits.sql` was
    created. Deployed migrations were not edited.
16. **Generated types.** `pnpm db:types` regenerated `database.types.ts` from
    the deployed schema; it was not manually edited. `toHydrationEvent` now takes
    the generated `EventRow`. The change route uses the ordinary `createClient`
    with generated `Database`, and `ChangeRecordingArguments` aliases the
    generated RPC `Args`. Removal omits the optional volume/time arguments,
    preserving their existing SQL NULL defaults. The migration-specific RPC
    overlay entry/import was removed; the unrelated processor overlay remains.
17. **Main files.** The migration; `components/hydration/event-timeline.tsx` and
    `recording-actions.tsx`; `lib/domain/hydration/recording-history.ts`;
    `lib/contracts/change-hydration-recording.ts`;
    `lib/application/hydration/change-hydration-recording.ts`;
    `app/api/v1/hydration-events/change/route.ts`; the two Supabase adapters;
    Today/Calendar pages; domain documentation; recording fixture, application,
    PostgreSQL and Playwright tests. PGlite and esbuild were added only as test
    dependencies (esbuild bundles the real UI for browser fixtures; no production
    test route was added).
18. **Validation.** `pnpm format`, `pnpm format:check`, `pnpm lint`,
    `pnpm typecheck`, `pnpm test` (514 tests), `pnpm test:e2e` (24 desktop/mobile
    tests), `pnpm build`, `git diff --check`, and `pnpm db:lint` passed. Eight
    embedded PostgreSQL tests execute the original relevant migrations plus the
    new migration and cover immutable rows, owner/RLS restrictions, source/type
    preservation, repeated edits/removals, retry conflicts, failed-replacement
    rollback, unchanged ordinary endpoint constraints, Community and reminder
    totals. Application tests cover units, invalid input, DST, cross-day totals,
    Today/Calendar/Trends/Profile and pace. Existing NFC, device and push tests
    pass. Browser tests use the real component with mocked mutation responses;
    they do not mutate production or replace an authenticated post-deployment
    smoke test. Multi-session lock contention was not exercised in PGlite.
    Initial sandbox port restrictions were resolved with approved execution;
    duplicate generated `.next/types/* 2.ts` artifacts were cleared before
    successful typechecking.
19. **Linked migration.** The authorized deployment dry run listed only
    `20260905120000_add_immutable_recording_edits.sql`, and that migration was
    then applied successfully. The CLI reported a non-fatal migration-catalog
    cache warning after application. Linked schema lint and the subsequent
    migration listing verify the deployed schema and matching history. No
    additional migration was created or applied during cleanup.
20. **Database-first release.** The migration was applied first, followed by
    `pnpm db:lint`, `pnpm db:types`, deletion of generated `.next` output and
    successful typechecking. The cleanup uses generated types and preserves
    runtime hydration semantics. Following complete release validation, commit
    the feature and cleanup as “Add hydration recording edit and removal” and
    push `origin main`; the existing Vercel Git integration should start its
    deployment automatically. Retain the additive schema and immutable
    correction records if application rollback is necessary.
21. **Production manual checklist.** After that release, sign in as a pilot
    member and confirm App, NFC and Physical button labels. Correct an 887 mL
    device completion to 800 mL, then 750 mL: verify one completion and one active
    “Physical button · Edited” entry. Repeat an NFC and App edit, including oz.
    Move a recording across midnight in the member timezone and check both
    Calendar days, Today, pace, Trends, Profile and Community. Remove the edited
    recording and verify zero remaining contribution. Check Cancel, Escape,
    keyboard wrap, 320 px layout, pending state and retry after an interrupted
    response. Try zero/negative/oversized/future inputs and a stale event; verify
    another member cannot edit/remove it. Confirm originals/reversals remain in
    database audit history. Confirm full/half App and NFC recording, NFC scan
    timestamp/idempotency, device hydration/status, and the next normal reminder
    evaluation still work. Do not send a notification directly for corrections.

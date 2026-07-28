import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728120000_add_atomic_hydration_event_processor.sql",
  ),
  "utf8",
);
const rlsMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260725120100_add_hydropop_rls.sql",
  ),
  "utf8",
);
const schemaMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260725120000_create_hydropop_schema.sql",
  ),
  "utf8",
);
const eventRoute = readFileSync(
  resolve(process.cwd(), "app/api/v1/hydration-events/route.ts"),
  "utf8",
);
const controls = readFileSync(
  resolve(process.cwd(), "app/(private)/today/development-controls.tsx"),
  "utf8",
);
const todayPage = readFileSync(
  resolve(process.cwd(), "app/(private)/today/page.tsx"),
  "utf8",
);

describe("atomic hydration event database contract", () => {
  it("is security-invoker, fixes the search path, and derives auth identity", () => {
    expect(migration).toMatch(
      /create or replace function public\.process_hydration_event\([\s\S]*?security invoker[\s\S]*?set search_path = ''/u,
    );
    expect(migration).toContain("v_user_id uuid := auth.uid();");
    expect(migration).not.toMatch(/\bp_user_id\b/u);
  });

  it("keeps RLS enabled and grants only event select/insert", () => {
    expect(rlsMigration).toContain(
      "alter table public.hydration_events enable row level security;",
    );
    expect(rlsMigration).toContain(
      "grant select, insert on table public.hydration_events to authenticated;",
    );
    expect(migration).not.toMatch(
      /\b(?:disable row level security|security definer)\b/iu,
    );
  });

  it("verifies bottle and device ownership under RLS", () => {
    expect(migration).toContain("bottles.user_id = v_user_id");
    expect(migration).toContain("devices.user_id = v_user_id");
    expect(migration).toContain("'BOTTLE_NOT_FOUND'");
    expect(migration).toContain("'DEVICE_NOT_FOUND'");
  });

  it("serializes idempotency and returns the original result", () => {
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain(
      "hydration_events.idempotency_key = p_idempotency_key",
    );
    expect(migration).toMatch(
      /'duplicate', true,[\s\S]*?'event', pg_catalog\.to_jsonb\(v_event\)/u,
    );
    expect(schemaMigration).toContain(
      "constraint hydration_events_user_idempotency_key",
    );
  });

  it("locks the bottle before reconstructing cycle state and inserting", () => {
    const bottleLock = migration.indexOf(
      "':hydration-bottle:' || p_bottle_id::text",
    );
    const stateRead = migration.indexOf("select hydration_events.event_type");
    const insertion = migration.indexOf("insert into public.hydration_events");

    expect(bottleLock).toBeGreaterThan(-1);
    expect(bottleLock).toBeLessThan(stateRead);
    expect(stateRead).toBeLessThan(insertion);
  });

  it("implements first fill, refill fallback, refill, and finish rules", () => {
    expect(migration).toContain("v_effective_event_type := 'fill_started'");
    expect(migration).toContain(
      "v_effective_volume_ml := v_bottle.capacity_ml",
    );
    expect(migration).toContain("'NO_ACTIVE_BOTTLE_CYCLE'");
    expect(migration).toContain(
      "v_last_cycle_type in ('fill_started', 'refill')",
    );
  });

  it("requires explicit manual and adjustment volumes", () => {
    expect(migration).toMatch(
      /p_event_type = 'manual_intake'[\s\S]*?p_volume_ml <= 0/u,
    );
    expect(migration).toMatch(
      /p_event_type = 'adjustment'[\s\S]*?p_volume_ml = 0/u,
    );
  });

  it("preserves bottle capacity at event time", () => {
    expect(migration).toContain("'bottle_capacity_ml', v_bottle.capacity_ml");
    expect(migration).toContain(
      "v_effective_volume_ml := v_bottle.capacity_ml",
    );
  });

  it("enforces immutable reversal ownership and uniqueness", () => {
    expect(migration).toContain("hydration_events.id = p_reverses_event_id");
    expect(migration).toContain("hydration_events.user_id = v_user_id");
    expect(migration).toContain("'EVENT_ALREADY_REVERSED'");
    expect(migration).toContain("'INVALID_REVERSAL'");
    expect(migration).not.toMatch(
      /\b(?:update|delete from)\s+public\.hydration_events\b/iu,
    );
  });

  it("revokes public and anonymous execution and grants authenticated only", () => {
    expect(migration).toMatch(
      /revoke all on function public\.process_hydration_event\([\s\S]*?\) from public, anon;/u,
    );
    expect(migration).toMatch(
      /grant execute on function public\.process_hydration_event\([\s\S]*?\) to authenticated;/u,
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.process_hydration_event\([\s\S]*?\) to (?:public|anon);/u,
    );
  });

  it("uses qualified database objects inside the RPC", () => {
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("public.bottles%rowtype");
    expect(migration).toContain("public.hydration_events%rowtype");
    expect(migration).toContain("from public.bottles");
    expect(migration).toContain("from public.devices");
    expect(migration).toContain("from public.profiles");
    expect(migration).toContain("from public.hydration_goals");
    expect(migration).toContain("from public.hydration_events");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("pg_catalog.jsonb_build_object");
  });

  it("adds the user/bottle/event-order index", () => {
    expect(migration).toContain("hydration_events_user_bottle_occurred_at_idx");
    expect(migration).toMatch(
      /user_id,\s*bottle_id,\s*occurred_at desc,\s*received_at desc,\s*id/u,
    );
  });

  it("authenticates the route before invoking the processor", () => {
    expect(eventRoute.indexOf("getAllowedUser()")).toBeLessThan(
      eventRoute.indexOf("processHydrationEvent({"),
    );
    expect(eventRoute).not.toContain("userId:");
  });

  it("keeps controls development-only and on the versioned API", () => {
    expect(todayPage).toContain('process.env.NODE_ENV === "development"');
    expect(controls).toContain('fetch("/api/v1/hydration-events"');
    expect(controls).toContain("crypto.randomUUID()");
    expect(controls).not.toContain(".from(");
  });
});

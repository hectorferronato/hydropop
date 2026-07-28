import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase", "migrations");
const completionMigration = readFileSync(
  resolve(
    migrationsDirectory,
    "20260728130000_add_typical_fill_and_bottle_completed.sql",
  ),
  "utf8",
);
const onboardingMigration = readFileSync(
  resolve(
    migrationsDirectory,
    "20260728131000_add_onboarding_typical_fill.sql",
  ),
  "utf8",
);
const controls = readFileSync(
  resolve(
    process.cwd(),
    "app",
    "(private)",
    "today",
    "development-controls.tsx",
  ),
  "utf8",
);
const todayPage = readFileSync(
  resolve(process.cwd(), "app", "(private)", "today", "page.tsx"),
  "utf8",
);
const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

describe("normal bottle completion database and product contract", () => {
  it("adds an optional typical fill constrained by physical capacity", () => {
    expect(completionMigration).toContain(
      "add column typical_fill_ml integer;",
    );
    expect(completionMigration).toMatch(
      /typical_fill_ml is null[\s\S]*?typical_fill_ml > 0[\s\S]*?typical_fill_ml <= capacity_ml/u,
    );
  });

  it("supports bottle_completed without removing legacy stored event types", () => {
    for (const eventType of [
      "fill_started",
      "refill",
      "bottle_finished",
      "bottle_completed",
    ]) {
      expect(completionMigration).toContain(`'${eventType}'`);
    }
  });

  it("keeps the deployed event RPC signature and hardened ownership contract", () => {
    expect(completionMigration).toMatch(
      /create or replace function public\.process_hydration_event\(\s*p_bottle_id uuid,\s*p_event_type text,\s*p_occurred_at timestamptz,\s*p_idempotency_key text,\s*p_source text,\s*p_volume_ml integer default null,\s*p_device_id uuid default null,\s*p_reverses_event_id uuid default null\s*\)/u,
    );
    expect(completionMigration).toContain("security invoker");
    expect(completionMigration).toContain("set search_path = ''");
    expect(completionMigration).toContain("v_user_id uuid := auth.uid();");
    expect(completionMigration).not.toMatch(/\bp_user_id\b/u);
    expect(
      completionMigration.match(
        /create or replace function public\.process_hydration_event\(/gu,
      ),
    ).toHaveLength(1);
  });

  it("allows only completion and correction actions through the normal RPC", () => {
    expect(completionMigration).toMatch(
      /if p_event_type not in \(\s*'bottle_completed',\s*'manual_intake',\s*'adjustment',\s*'event_reversed'\s*\)/u,
    );
  });

  it("requires an active owned bottle and snapshots the effective amount", () => {
    expect(completionMigration).toContain("bottles.user_id = v_user_id");
    expect(completionMigration).toContain(
      "v_bottle.archived_at is not null or not v_bottle.is_primary",
    );
    expect(completionMigration).toMatch(
      /v_effective_volume_ml := coalesce\(\s*v_bottle\.typical_fill_ml,\s*v_bottle\.capacity_ml\s*\);/u,
    );
    expect(completionMigration).toContain(
      "'bottle_capacity_ml', v_bottle.capacity_ml",
    );
    expect(completionMigration).toContain(
      "'typical_fill_ml', v_bottle.typical_fill_ml",
    );
    expect(completionMigration).toContain(
      "'effective_credited_ml', v_effective_volume_ml",
    );
  });

  it("rejects a client-supplied partial amount for bottle_completed", () => {
    expect(completionMigration).toMatch(
      /p_event_type = 'bottle_completed'[\s\S]*?p_volume_ml is not null[\s\S]*?'INVALID_INPUT'/u,
    );
  });

  it("preserves idempotency, bottle locking, reversals, and grants", () => {
    expect(completionMigration).toContain(
      "':hydration-idempotency:' || p_idempotency_key",
    );
    expect(completionMigration).toContain(
      "':hydration-bottle:' || p_bottle_id::text",
    );
    expect(completionMigration).toContain(
      "hydration_events.reverses_event_id = v_original.id",
    );
    expect(completionMigration).toMatch(
      /revoke execute on function public\.process_hydration_event\([\s\S]*?\) from public, anon;/u,
    );
    expect(completionMigration).toMatch(
      /grant execute on function public\.process_hydration_event\([\s\S]*?\) to authenticated;/u,
    );
  });

  it("adds one optional trailing onboarding argument without an overload", () => {
    expect(onboardingMigration).toMatch(
      /drop function if exists public\.save_onboarding\(\s*text,\s*text,\s*text,\s*time,\s*time,\s*integer,\s*text,\s*integer,\s*text,\s*text,\s*boolean,\s*uuid\s*\);/u,
    );
    expect(onboardingMigration).toMatch(
      /p_bottle_id uuid default null,\s*p_bottle_typical_fill_ml integer default null\s*\)/u,
    );
    expect(
      onboardingMigration.match(/create function public\.save_onboarding\(/gu),
    ).toHaveLength(1);
    expect(onboardingMigration).toContain("security invoker");
    expect(onboardingMigration).toContain("set search_path = ''");
    expect(onboardingMigration).toContain("v_user_id uuid := auth.uid();");
    expect(onboardingMigration).not.toMatch(/\bp_user_id\b/u);
  });

  it("exposes one completion control and no legacy cycle controls", () => {
    expect(controls).toContain('label: "Complete one bottle"');
    expect(controls).toContain('eventType: "bottle_completed"');
    expect(controls).not.toContain('label: "Start first fill"');
    expect(controls).not.toContain('label: "Refill"');
    expect(controls).not.toContain('label: "Finish bottle"');
    expect(todayPage).toContain("Last bottle completed");
    expect(todayPage).not.toContain("bottle cycle");
    expect(todayPage).not.toContain("bottle-cycle");
  });

  it("documents that NFC confirmation creates only bottle_completed", () => {
    expect(readme).toContain("NFC confirmation → `bottle_completed`");
  });
});

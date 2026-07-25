import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase", "migrations");
const schemaMigration = readFileSync(
  resolve(migrationsDirectory, "20260725120000_create_hydropop_schema.sql"),
  "utf8",
);
const rlsMigration = readFileSync(
  resolve(migrationsDirectory, "20260725120100_add_hydropop_rls.sql"),
  "utf8",
);
const onboardingMigration = readFileSync(
  resolve(migrationsDirectory, "20260725130000_add_onboarding_function.sql"),
  "utf8",
);
const supabaseConfig = readFileSync(
  resolve(process.cwd(), "supabase", "config.toml"),
  "utf8",
);

const userOwnedTables = [
  "profiles",
  "bottles",
  "hydration_goals",
  "nfc_tags",
  "devices",
  "hydration_events",
] as const;

describe("HydroPOP database migrations", () => {
  it("enables row-level security on every user-owned table", () => {
    for (const table of userOwnedTables) {
      expect(rlsMigration).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("never creates an unrestricted user-owned policy", () => {
    expect(rlsMigration).not.toMatch(/using\s*\(\s*true\s*\)/iu);
    expect(rlsMigration).not.toMatch(/with\s+check\s*\(\s*true\s*\)/iu);
  });

  it("does not grant authenticated clients event mutation privileges", () => {
    expect(rlsMigration).toContain(
      "grant select, insert on table public.hydration_events to authenticated;",
    );
    expect(rlsMigration).not.toMatch(
      /grant[^;]*(?:update|delete)[^;]*public\.hydration_events/iu,
    );
    expect(rlsMigration).not.toMatch(
      /create policy[\s\S]*?on public\.hydration_events[\s\S]*?for (?:update|delete)/iu,
    );
  });

  it("keeps event ownership and idempotency constraints in the schema", () => {
    expect(schemaMigration).toContain(
      "constraint hydration_events_user_idempotency_key",
    );
    expect(schemaMigration).toContain(
      "constraint hydration_events_bottle_owner_fk",
    );
    expect(schemaMigration).toContain(
      "constraint hydration_events_device_owner_fk",
    );
    expect(schemaMigration).toContain(
      "before update or delete on public.hydration_events",
    );
  });

  it("does not destructively mutate Auth users or Auth configuration", () => {
    expect(schemaMigration).not.toMatch(
      /\b(?:delete\s+from|truncate(?:\s+table)?|drop\s+table|alter\s+table)\s+auth\./iu,
    );
    expect(schemaMigration).not.toMatch(
      /\b(?:insert\s+into|update)\s+auth\./iu,
    );
  });

  it("creates profiles through a hardened security-definer trigger", () => {
    expect(schemaMigration).toMatch(
      /create or replace function public\.create_profile_for_auth_user\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''[\s\S]*?insert into public\.profiles \(id\)[\s\S]*?values \(new\.id\)[\s\S]*?on conflict \(id\) do nothing;/iu,
    );
    expect(schemaMigration).toContain(
      "after insert on auth.users\nfor each row execute function public.create_profile_for_auth_user();",
    );
  });

  it("idempotently backfills only Auth IDs into minimal profiles", () => {
    expect(schemaMigration).toContain(
      [
        "insert into public.profiles (id)",
        "select auth_user.id",
        "from auth.users as auth_user",
        "on conflict (id) do nothing;",
      ].join("\n"),
    );
    expect(schemaMigration).not.toMatch(
      /raw_(?:user|app)_meta_data|user_metadata|app_metadata/iu,
    );
  });

  it("keeps automatic seed execution disabled", () => {
    expect(supabaseConfig).toMatch(
      /\[db\.seed\][\s\S]*?enabled = false[\s\S]*?sql_paths = \["\.\/seed\.sql"\]/u,
    );
  });

  it("derives onboarding ownership from the authenticated database user", () => {
    expect(onboardingMigration).toContain("v_user_id uuid := auth.uid();");
    expect(onboardingMigration).not.toMatch(/\bp_user_id\b/u);
    expect(onboardingMigration).toContain("and bottles.user_id = v_user_id");
    expect(onboardingMigration).toContain("security invoker");
    expect(onboardingMigration).toContain("set search_path = ''");
  });
});

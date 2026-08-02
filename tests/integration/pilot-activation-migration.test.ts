import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260802120000_add_near_zero_setup_pilot_activation.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const normalized = migration.replaceAll(/\s+/gu, " ").trim().toLowerCase();
const saveFunction = normalized.slice(
  normalized.indexOf("create function public.save_onboarding"),
  normalized.indexOf("create function public.activate_pilot_nfc_tag"),
);
const activationFunction = normalized.slice(
  normalized.indexOf("create function public.activate_pilot_nfc_tag"),
  normalized.indexOf("revoke execute on function public.save_onboarding"),
);

describe("near-zero-setup pilot activation migration", () => {
  it("replaces the exact onboarding signature without an overload", () => {
    expect(normalized).toContain(
      "drop function if exists public.save_onboarding( text, text, text, time, time, integer, text, integer, text, text, boolean, uuid, integer );",
    );
    expect(saveFunction).toContain("p_pilot_token_hash text default null");
    expect(
      saveFunction.indexOf("p_pilot_token_hash text default null"),
    ).toBeGreaterThan(
      saveFunction.indexOf("p_bottle_typical_fill_ml integer default null"),
    );
    expect(
      normalized.match(/create function public\.save_onboarding/gu),
    ).toHaveLength(1);
  });

  it("keeps both mutation RPCs authenticated SECURITY INVOKER functions", () => {
    for (const functionSql of [saveFunction, activationFunction]) {
      expect(functionSql).toContain("security invoker");
      expect(functionSql).toContain("set search_path = ''");
      expect(functionSql).toContain("auth.uid()");
      expect(functionSql).not.toContain("p_user_id");
      expect(functionSql).not.toContain("security definer");
    }

    expect(normalized).toContain(
      "revoke execute on function public.activate_pilot_nfc_tag(text) from public, anon",
    );
    expect(normalized).toContain(
      "grant execute on function public.activate_pilot_nfc_tag(text) to authenticated",
    );
  });

  it("creates or claims pilot in the same onboarding transaction", () => {
    expect(saveFunction).toContain("if p_pilot_token_hash is not null then");
    expect(saveFunction).toContain("from public.nfc_tags");
    expect(saveFunction).toContain("nfc_tags.friendly_code = 'pilot'");
    expect(saveFunction).toContain("insert into public.nfc_tags");
    expect(saveFunction).toContain("'hydropop pilot tag'");
    expect(saveFunction).toContain("'active'");
    expect(normalized.startsWith("begin;")).toBe(true);
    expect(normalized.endsWith("commit;")).toBe(true);
  });

  it("serializes retries and reuses the active primary bottle and pilot tag", () => {
    expect(saveFunction).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(saveFunction).toContain(
      "if p_bottle_id is null then select bottles.id",
    );
    expect(saveFunction).toContain("and bottles.is_primary");
    expect(saveFunction).toContain(
      "if v_bottle_id is null then insert into public.bottles",
    );
    expect(saveFunction).toContain("if v_pilot_tag.id is not null then");
    expect(saveFunction).toContain("bottle_id = v_bottle_id");
    expect(activationFunction).toContain("pg_catalog.pg_advisory_xact_lock");
  });

  it("preserves historical friendly-code reservations as a safe conflict", () => {
    for (const functionSql of [saveFunction, activationFunction]) {
      expect(functionSql).toContain(
        "from public.nfc_friendly_code_reservations",
      );
      expect(functionSql).toContain("if v_reserved_pilot_tag_id is not null");
      expect(functionSql).toContain("using errcode = 'p0001'");
    }
  });

  it("stores only validated SHA-256 hashes and never accepts raw tokens", () => {
    expect(normalized).toContain("!~ '^[0-9a-f]{64}$'");
    expect(normalized).not.toContain("p_raw_token");
    expect(normalized).not.toContain("service_role");
  });
});

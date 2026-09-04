import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const migration = read(
  "supabase/migrations/20260904120000_add_physical_button_backend.sql",
);
const hydrationRoute = read("app/api/v1/device/hydration/route.ts");
const statusRoute = read("app/api/v1/device/status/route.ts");
const managementRoute = read("app/api/v1/physical-devices/route.ts");
const infrastructure = read("lib/infrastructure/supabase/physical-devices.ts");
const revalidation = read(
  "lib/application/hydration/revalidate-hydration-views.ts",
);
const eventTypes = read("lib/domain/hydration/event-types.ts");

function functionBody(name: string, nextName: string): string {
  const start = migration.indexOf(`create function public.${name}`);
  const end = migration.indexOf(`create function public.${nextName}`, start);
  return migration.slice(start, end);
}

describe("physical button database boundary", () => {
  it("extends devices with a hash-only revocable physical credential", () => {
    expect(migration).toContain("add column credential_hash text");
    expect(migration).toContain("add column revoked_at timestamptz");
    expect(migration).toContain("'physical_button'");
    expect(migration).toContain("credential_hash ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain(
      "create unique index devices_credential_hash_idx",
    );
    expect(migration).not.toMatch(/\braw_token\b|\bdevice_token\b/iu);
  });

  it("never grants credential-hash reads and protects direct physical writes", () => {
    const selectGrant = migration.match(
      /grant select \([\s\S]*?\) on public\.devices to authenticated;/u,
    )?.[0];

    expect(selectGrant).toBeDefined();
    expect(selectGrant).not.toContain("credential_hash");
    expect(migration).toContain("devices_protect_physical_button_credentials");
    expect(migration).toContain("current_user = 'authenticated'");
  });

  it("derives management ownership from auth.uid and accepts only active owned bottles", () => {
    for (const [name, nextName] of [
      ["create_physical_button_device", "update_physical_button_device"],
      ["update_physical_button_device", "revoke_physical_button_device"],
      ["revoke_physical_button_device", "physical_button_status_state"],
    ] as const) {
      const definition = functionBody(name, nextName);
      expect(definition).toContain("v_user_id uuid := auth.uid()");
      expect(definition).not.toMatch(/\bp_user_id\b/u);
      expect(definition).toContain("security definer");
      expect(definition).toContain("set search_path = ''");
    }
    expect(migration).toContain("bottles.user_id = v_user_id");
    expect(migration).toContain("bottles.archived_at is null");
  });

  it("grants management only to authenticated and device RPCs only to anon", () => {
    expect(migration).toContain(
      "grant execute on function public.create_physical_button_device(uuid, text, text)\nto authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.get_physical_button_status(text, text)\nto anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.record_physical_button_hydration(text, text, text, timestamptz)\nto anon;",
    );
  });

  it("authenticates the Next.js boundary and active non-revoked credential before private data access", () => {
    const status = functionBody(
      "get_physical_button_status",
      "record_physical_button_hydration",
    );

    expect(migration).toContain("public.physical_button_api_is_authorized");
    expect(migration).toContain(
      "decrypted_secrets.name = 'hydropop_physical_device_rpc_secret'",
    );
    expect(status).toContain(
      "not public.physical_button_api_is_authorized(p_api_secret)",
    );
    expect(status).toContain("p_credential_hash !~ '^[0-9a-f]{64}$'");
    expect(status).toContain("devices.credential_hash = p_credential_hash");
    expect(status).toContain("devices.device_type = 'physical_button'");
    expect(status).toContain("devices.status = 'active'");
    expect(status).toContain("devices.revoked_at is null");
    expect(status).toContain("'DEVICE_UNAUTHORIZED'");
  });

  it("delegates one authoritative device completion without accepting owner, bottle, or volume", () => {
    const record = migration.slice(
      migration.indexOf(
        "create function public.record_physical_button_hydration",
      ),
    );

    expect(record).toContain("public.process_hydration_event(");
    expect(record).toMatch(
      /v_device\.bottle_id,\s*'bottle_completed',\s*p_occurred_at,[\s\S]*?'device',\s*null,\s*v_device\.id/u,
    );
    expect(record).not.toMatch(
      /\bp_user_id\b|\bp_bottle_id\b|\bp_volume_ml\b/u,
    );
    expect(migration).toMatch(
      /v_effective_volume_ml := coalesce\(\s*v_bottle\.typical_fill_ml,\s*v_bottle\.capacity_ml/u,
    );
  });

  it("scopes idempotency to the device and verifies immutable replay semantics", () => {
    expect(migration).toContain(
      "'physical-device:'\n    || v_device.id::text || ':' || p_idempotency_key",
    );
    expect(migration).toContain(
      "':hydration-idempotency:' || p_idempotency_key",
    );
    expect(migration).toContain(
      "when (v_result ->> 'duplicate')::boolean then 'existing'",
    );
    expect(migration).toContain(
      "v_event ->> 'event_type' is distinct from 'bottle_completed'",
    );
    expect(migration).toContain(
      "v_event ->> 'source' is distinct from 'device'",
    );
  });

  it("preserves seven-day history, future skew, event source, and completed bottle semantics", () => {
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("interval '7 days'");
    expect(migration).toContain("'device'");
    expect(eventTypes).toContain('"device"');
    expect(migration).toContain(
      "'recordedMl', (v_event ->> 'volume_ml')::integer",
    );
    expect(migration).toContain(
      "hydration_events.event_type <> 'event_reversed'",
    );
  });

  it("keeps status GET read-only and returns no private identifiers", () => {
    const status = functionBody(
      "get_physical_button_status",
      "record_physical_button_hydration",
    );

    expect(status).not.toMatch(/\b(?:insert|update|delete)\b/iu);
    for (const privateField of ["userId", "bottleId", "tokenHash", "email"]) {
      expect(statusRoute).not.toContain(privateField);
    }
  });

  it("does not weaken RLS or expose device-source inserts to authenticated clients", () => {
    expect(migration).not.toMatch(
      /alter table public\.[a-z_]+ (?:disable row level security|no force row level security)/iu,
    );
    expect(migration).toContain("and source <> 'device'");
    expect(migration).toContain(
      "or (p_source = 'device' and current_user = 'authenticated')",
    );
  });
});

describe("physical button Next.js boundary", () => {
  it("uses strict request input, server receipt time fallback, and bounded JSON", () => {
    expect(hydrationRoute).toContain(
      "physicalDeviceHydrationInputSchema.safeParse",
    );
    expect(hydrationRoute).toContain("readBoundedJson(request, 2_048)");
    expect(hydrationRoute).toContain(
      "parsed.data.occurredAt ?? receiptTime.toISOString()",
    );
    expect(hydrationRoute).toContain("validateEventWindow");
  });

  it("returns created versus existing and revalidates only a new hydration write", () => {
    expect(hydrationRoute).toContain('result.result === "created"');
    expect(hydrationRoute).toContain("revalidateHydrationViews()");
    for (const path of [
      '"/today"',
      '"/calendar"',
      '"/trends"',
      '"/profile"',
      '"/community"',
      '"/u/[username]"',
    ]) {
      expect(revalidation).toContain(path);
    }
  });

  it("uses the public key with narrow RPCs and introduces no service-role key", () => {
    expect(infrastructure).toContain("getPublicSupabaseConfig");
    expect(infrastructure).toContain("getPhysicalDeviceRpcSecret");
    expect(infrastructure).toContain("persistSession: false");
    expect(infrastructure).not.toMatch(/service[_-]?role/iu);
    expect(hydrationRoute).not.toMatch(/service[_-]?role/iu);
    expect(statusRoute).not.toMatch(/service[_-]?role/iu);
  });

  it("derives the management owner from the authenticated session", () => {
    expect(managementRoute).toContain("getAllowedUser()");
    expect(managementRoute).toContain("authentication.user.id");
    expect(managementRoute).not.toContain("p_user_id");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaMigration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260725120000_create_hydropop_schema.sql",
  ),
  "utf8",
);
const rlsMigration = readFileSync(
  resolve(root, "supabase/migrations/20260725120100_add_hydropop_rls.sql"),
  "utf8",
);
const nfcMigration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260728140000_add_secure_nfc_tag_management.sql",
  ),
  "utf8",
);
const scanPage = readFileSync(resolve(root, "app/t/[token]/page.tsx"), "utf8");
const confirmationClient = readFileSync(
  resolve(root, "app/t/[token]/nfc-confirmation.tsx"),
  "utf8",
);
const completionRoute = readFileSync(
  resolve(root, "app/api/v1/nfc-tags/complete/route.ts"),
  "utf8",
);
const createRoute = readFileSync(
  resolve(root, "app/api/v1/nfc-tags/route.ts"),
  "utf8",
);
const rotateRoute = readFileSync(
  resolve(root, "app/api/v1/nfc-tags/[id]/rotate/route.ts"),
  "utf8",
);
const revokeRoute = readFileSync(
  resolve(root, "app/api/v1/nfc-tags/[id]/revoke/route.ts"),
  "utf8",
);
const updateRoute = readFileSync(
  resolve(root, "app/api/v1/nfc-tags/[id]/route.ts"),
  "utf8",
);

const rpcNames = [
  "create_nfc_tag",
  "rotate_nfc_tag",
  "update_nfc_tag",
  "revoke_nfc_tag",
  "mark_nfc_tag_confirmed",
] as const;

describe("NFC management and scan contracts", () => {
  it("stores only a unique lowercase SHA-256 hash", () => {
    expect(schemaMigration).toContain("token_hash text not null unique");
    expect(schemaMigration).toContain("check (token_hash ~ '^[0-9a-f]{64}$')");
    expect(schemaMigration).not.toMatch(/\braw_token\b/iu);
    expect(nfcMigration).not.toMatch(/\braw_token\b/iu);
  });

  it("keeps NFC tags private and RLS-protected", () => {
    expect(rlsMigration).toContain(
      "alter table public.nfc_tags enable row level security;",
    );
    expect(rlsMigration).toContain("create policy nfc_tags_select_own");
    expect(rlsMigration).not.toMatch(
      /grant\s+select[^;]*public\.nfc_tags[^;]*\bto anon\b/iu,
    );
    expect(rlsMigration).toContain(
      "grant select, insert, update on table public.nfc_tags to authenticated;",
    );
  });

  it("uses a unique exact hash lookup and owner-scoped application query", () => {
    const source = readFileSync(
      resolve(root, "lib/infrastructure/supabase/nfc.ts"),
      "utf8",
    );

    expect(schemaMigration).toContain("token_hash text not null unique");
    expect(source).toContain('.eq("token_hash", tokenHash)');
    expect(source).toContain('.eq("user_id", userId)');
    expect(source).toContain('.eq("status", "active")');
  });

  it("hardens every lifecycle RPC with invoker security and auth identity", () => {
    for (const rpcName of rpcNames) {
      expect(nfcMigration).toMatch(
        new RegExp(
          `create function public\\.${rpcName}\\([\\s\\S]*?security invoker[\\s\\S]*?set search_path = ''`,
          "u",
        ),
      );
    }

    expect(nfcMigration).not.toMatch(/\bp_user_id\b/u);
    expect(
      nfcMigration.match(/v_user_id uuid := auth\.uid\(\);/gu),
    ).toHaveLength(rpcNames.length);
  });

  it("revokes public and anonymous execution and grants authenticated only", () => {
    for (const rpcName of rpcNames) {
      expect(nfcMigration).toMatch(
        new RegExp(
          `revoke execute on function public\\.${rpcName}\\([\\s\\S]*?\\)\\s*from public, anon;`,
          "u",
        ),
      );
      expect(nfcMigration).toMatch(
        new RegExp(
          `grant execute on function public\\.${rpcName}\\([\\s\\S]*?\\)\\s*to authenticated;`,
          "u",
        ),
      );
    }
  });

  it("validates active owned bottle assignment in create and update RPCs", () => {
    expect(nfcMigration.match(/bottles\.user_id = v_user_id/gu)).toHaveLength(
      2,
    );
    expect(nfcMigration.match(/bottles\.is_primary/gu)).toHaveLength(2);
    expect(nfcMigration.match(/bottles\.archived_at is null/gu)).toHaveLength(
      2,
    );
  });

  it("rotates by replacing only the hash and revokes without deletion", () => {
    expect(nfcMigration).toMatch(
      /update public\.nfc_tags\s*set token_hash = p_token_hash/u,
    );
    expect(nfcMigration).toMatch(
      /update public\.nfc_tags\s*set status = 'revoked'/u,
    );
    expect(nfcMigration).not.toMatch(/delete from public\.nfc_tags/iu);
  });

  it("updates last confirmed use only for a successful NFC bottle completion", () => {
    expect(nfcMigration).toContain(
      "hydration_events.event_type = 'bottle_completed'",
    );
    expect(nfcMigration).toContain("hydration_events.source = 'nfc'");
    expect(nfcMigration).toContain("set last_scanned_at = case");
    expect(nfcMigration).toContain("Read-only scans do not update it.");
  });

  it("keeps GET scan rendering read-only", () => {
    expect(scanPage).not.toMatch(/\.(?:insert|update|delete|rpc)\s*\(/u);
    expect(scanPage).not.toContain("processHydrationEvent");
    expect(scanPage).not.toContain("completeNfcBottle");
    expect(scanPage).toContain("Loading or refreshing this page never records");
  });

  it("requires an explicit POST confirmation and never auto-submits", () => {
    expect(confirmationClient).toContain('fetch("/api/v1/nfc-tags/complete"');
    expect(confirmationClient).toContain('method: "POST"');
    expect(confirmationClient).toContain("onClick={() => void submit(false)}");
    expect(confirmationClient).toContain("crypto.randomUUID()");
    expect(confirmationClient).not.toMatch(/useEffect\s*\(/u);
  });

  it("reuses the authoritative hydration processor with no derived browser input", () => {
    expect(completionRoute).toContain("completeNfcBottle({");
    expect(completionRoute).toContain('"process_hydration_event"');
    expect(completionRoute).not.toContain("volumeMl:");
    expect(completionRoute).not.toContain("bottleId:");
    expect(completionRoute).not.toContain("userId:");
  });

  it("authenticates every management endpoint before mutation", () => {
    for (const route of [
      createRoute,
      rotateRoute,
      revokeRoute,
      updateRoute,
      completionRoute,
    ]) {
      expect(route).toContain("getAllowedUser()");
      expect(route.indexOf("getAllowedUser()")).toBeLessThan(
        route.indexOf(".rpc(") === -1 ? route.length : route.indexOf(".rpc("),
      );
    }
  });

  it("does not log complete raw tokens", () => {
    for (const source of [
      createRoute,
      rotateRoute,
      revokeRoute,
      updateRoute,
      completionRoute,
    ]) {
      expect(source).not.toMatch(
        /console\.(?:error|log|warn)\([^)]*(?:rawToken|nfcUrl|tokenHash)/u,
      );
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const deployedMigration = readFileSync(
  join(
    root,
    "supabase/migrations/20260804120000_add_web_push_hydration_reminders.sql",
  ),
  "utf8",
);
const fixMigration = readFileSync(
  join(
    root,
    "supabase/migrations/20260805120000_fix_web_push_subscription_registration.sql",
  ),
  "utf8",
);
const registrationRoute = readFileSync(
  join(root, "app/api/v1/push-subscriptions/route.ts"),
  "utf8",
);
const testNotificationRoute = readFileSync(
  join(root, "app/api/v1/push-notifications/test/route.ts"),
  "utf8",
);

const registrationFunctionStart = fixMigration.indexOf(
  "create or replace function public.register_web_push_subscription",
);
const registrationFunctionEnd = fixMigration.indexOf(
  "\n$$;",
  registrationFunctionStart,
);
const registrationFunction = fixMigration.slice(
  registrationFunctionStart,
  registrationFunctionEnd + 4,
);
const deployedUpdateGrantStart = deployedMigration.indexOf(
  "grant update (\n  endpoint,",
);
const deployedUpdateGrantTerminator =
  ") on public.web_push_subscriptions to authenticated;";
const deployedUpdateGrantEnd = deployedMigration.indexOf(
  deployedUpdateGrantTerminator,
  deployedUpdateGrantStart,
);
const deployedUpdateGrant = deployedMigration.slice(
  deployedUpdateGrantStart,
  deployedUpdateGrantEnd + deployedUpdateGrantTerminator.length,
);

describe("Web Push subscription registration privilege fix", () => {
  it("documents the direct-upsert privilege mismatch without widening identity-column grants", () => {
    expect(deployedUpdateGrant).toContain("endpoint,");
    expect(deployedUpdateGrant).not.toContain("endpoint_hash");
    expect(deployedUpdateGrant).not.toContain("user_id");
    expect(fixMigration).not.toContain("grant update (user_id, endpoint_hash)");
    expect(fixMigration).not.toContain("grant select on table");
  });

  it("registers and upserts through an authenticated owner-scoped RPC", () => {
    expect(registrationRoute).toContain(
      'supabase.rpc("register_web_push_subscription"',
    );
    expect(registrationFunction).toContain("security invoker");
    expect(registrationFunction).toContain("set search_path = ''");
    expect(registrationFunction).toContain("v_user_id uuid := auth.uid()");
    expect(registrationFunction).toContain(
      "insert into public.web_push_subscriptions as subscriptions",
    );
    expect(registrationFunction).toContain(
      "on conflict (endpoint_hash) do update",
    );
    expect(registrationFunction).toContain(
      "where subscriptions.user_id = v_user_id",
    );
  });

  it("does not let callers choose an owner or mutate another user's conflict", () => {
    expect(registrationFunction).not.toContain("p_user_id");
    expect(registrationRoute).not.toContain("p_user_id");
    expect(registrationRoute).not.toContain("parsed.data.userId");
    expect(registrationFunction).toContain(
      "raise exception 'SUBSCRIPTION_UNAVAILABLE' using errcode = '42501'",
    );
    expect(deployedMigration).toContain(
      'create policy "users register their own push subscriptions"',
    );
    expect(deployedMigration).toContain(
      'create policy "users update their own push subscriptions"',
    );
    expect(deployedMigration).toContain(
      "with check ((select auth.uid()) = user_id)",
    );
  });

  it("rejects anonymous execution and grants only authenticated registration", () => {
    expect(registrationFunction).toContain(
      "raise exception 'UNAUTHORIZED' using errcode = '42501'",
    );
    expect(fixMigration).toContain("from public, anon;");
    expect(fixMigration).toContain("to authenticated;");
    expect(registrationRoute).toContain('authentication.status !== "allowed"');
  });

  it("returns safe metadata without exposing subscription secrets", () => {
    const returnedMetadata = registrationFunction.slice(
      registrationFunction.indexOf("return pg_catalog.jsonb_build_object"),
    );

    expect(returnedMetadata).toContain("'subscription_id'");
    expect(returnedMetadata).toContain("'active'");
    expect(returnedMetadata).toContain("'registered'");
    expect(returnedMetadata).not.toContain("'endpoint'");
    expect(returnedMetadata).not.toContain("'endpoint_hash'");
    expect(returnedMetadata).not.toContain("'p256dh'");
    expect(returnedMetadata).not.toContain("'auth'");
    expect(registrationRoute).toContain(
      "return apiSuccess({ registered: true }, 201)",
    );
  });

  it("keeps revocation and test-notification lookup owner scoped", () => {
    expect(registrationRoute).toContain(
      ".update({ revoked_at: new Date().toISOString() })",
    );
    expect(registrationRoute).toContain(
      '.eq("user_id", authentication.user.id)',
    );
    expect(testNotificationRoute).toContain(
      '.eq("user_id", authentication.user.id)',
    );
    expect(testNotificationRoute).toContain(
      '.select("id, endpoint, p256dh, auth")',
    );
  });

  it("preserves RLS and introduces neither service-role access nor destructive SQL", () => {
    expect(deployedMigration).toContain(
      "alter table public.web_push_subscriptions enable row level security",
    );
    expect(fixMigration).not.toContain("disable row level security");
    expect(fixMigration).not.toContain("service_role");
    expect(registrationRoute).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(fixMigration).not.toMatch(/\b(?:delete|drop|truncate)\b/iu);
  });
});

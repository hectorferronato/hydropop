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
    "supabase/migrations/20260805121000_fix_notification_preference_updates.sql",
  ),
  "utf8",
);
const preferenceRoute = readFileSync(
  join(root, "app/api/v1/notification-preferences/route.ts"),
  "utf8",
);
const testNotificationRoute = readFileSync(
  join(root, "app/api/v1/push-notifications/test/route.ts"),
  "utf8",
);

const functionStart = fixMigration.indexOf(
  "create or replace function public.set_hydration_notification_preferences",
);
const functionEnd = fixMigration.indexOf("\n$$;", functionStart);
const preferenceFunction = fixMigration.slice(functionStart, functionEnd + 4);

describe("notification preference privilege fix", () => {
  it("documents the direct-upsert privilege mismatch without widening table grants", () => {
    expect(deployedMigration).toContain(
      "grant update (pace_reminders_enabled)\non public.hydration_notification_preferences to authenticated",
    );
    expect(deployedMigration).not.toContain(
      "grant update (user_id, pace_reminders_enabled)",
    );
    expect(fixMigration).not.toContain("grant update");
    expect(fixMigration).not.toContain("grant select");
  });

  it("inserts once and updates only the existing owner's preference", () => {
    expect(preferenceFunction).toContain(
      "insert into public.hydration_notification_preferences as preferences",
    );
    expect(preferenceFunction).toContain("values (\n    v_user_id,");
    expect(preferenceFunction).toContain("on conflict (user_id) do update");
    expect(preferenceFunction).toContain(
      "set pace_reminders_enabled = excluded.pace_reminders_enabled",
    );
    expect(preferenceFunction).not.toMatch(/set\s+user_id\s*=/iu);
    expect(preferenceFunction).not.toContain("p_user_id");
  });

  it("uses authenticated SECURITY INVOKER execution and existing owner RLS", () => {
    expect(preferenceFunction).toContain("security invoker");
    expect(preferenceFunction).toContain("set search_path = ''");
    expect(preferenceFunction).toContain("v_user_id uuid := auth.uid()");
    expect(preferenceFunction).toContain(
      "raise exception 'UNAUTHORIZED' using errcode = '42501'",
    );
    expect(fixMigration).toContain("from public, anon;");
    expect(fixMigration).toContain("to authenticated;");
    expect(deployedMigration).toContain(
      "alter table public.hydration_notification_preferences enable row level security",
    );
    expect(deployedMigration).toContain(
      'create policy "users update their own notification preferences"',
    );
    expect(deployedMigration).toContain(
      "with check ((select auth.uid()) = user_id)",
    );
  });

  it("returns only safe preference metadata", () => {
    const returnedMetadata = preferenceFunction.slice(
      preferenceFunction.indexOf("return pg_catalog.jsonb_build_object"),
    );

    expect(returnedMetadata).toContain("'pace_reminders_enabled'");
    expect(returnedMetadata).toContain("'updated_at'");
    expect(returnedMetadata).not.toContain("'user_id'");
    expect(returnedMetadata).not.toContain("web_push_subscriptions");
    expect(returnedMetadata).not.toContain("hydration_reminder_state");
  });

  it("routes only the boolean preference through the narrow RPC", () => {
    expect(preferenceRoute).toContain(
      '.rpc("set_hydration_notification_preferences"',
    );
    expect(preferenceRoute).toContain(
      "p_pace_reminders_enabled: parsed.data.paceRemindersEnabled",
    );
    expect(preferenceRoute).not.toContain("authentication.user.id");
    expect(preferenceRoute).not.toContain("parsed.data.user_id");
    expect(preferenceRoute).toContain(
      'safeDatabaseDiagnostic("set_hydration_notification_preferences", error)',
    );
  });

  it("does not touch subscriptions, worker state, test delivery, or service-role access", () => {
    expect(fixMigration).not.toContain("web_push_subscriptions");
    expect(fixMigration).not.toContain("hydration_reminder_state");
    expect(fixMigration).not.toContain("push_notification_outbox");
    expect(fixMigration).not.toContain("service_role");
    expect(preferenceRoute).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(testNotificationRoute).toContain("sendWebPush(subscription");
    expect(testNotificationRoute).toContain(
      '.eq("user_id", authentication.user.id)',
    );
  });
});

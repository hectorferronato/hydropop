import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260804120000_add_web_push_hydration_reminders.sql",
  ),
  "utf8",
);
const workerRoute = readFileSync(
  join(root, "app/api/internal/push-reminders/run/route.ts"),
  "utf8",
);
const workerClient = readFileSync(
  join(root, "lib/infrastructure/supabase/push.ts"),
  "utf8",
);
const preferenceRoute = readFileSync(
  join(root, "app/api/v1/notification-preferences/route.ts"),
  "utf8",
);
const subscriptionRoute = readFileSync(
  join(root, "app/api/v1/push-subscriptions/route.ts"),
  "utf8",
);

const workerFunctions = [
  "claim_push_reminder_evaluations",
  "apply_push_reminder_evaluation",
  "claim_push_notification_outbox",
  "complete_push_notification_outbox",
] as const;

function definition(name: (typeof workerFunctions)[number]): string {
  const start = migration.indexOf(`create or replace function public.${name}`);
  const end = migration.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing function ${name}`);
  return migration.slice(start, end + 4);
}

describe("internal Push worker database authorization", () => {
  it("uses the publishable-key client without a signed-in user session", () => {
    expect(workerClient).toContain("publishableKey");
    expect(workerClient).toContain("persistSession: false");
    expect(workerClient).toContain("autoRefreshToken: false");
    expect(workerClient).not.toContain("accessToken");
    expect(workerClient).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("grants anon only the four secret-protected worker entry points", () => {
    for (const name of workerFunctions) {
      expect(migration).toMatch(
        new RegExp(
          `grant execute on function public\\.${name}\\([\\s\\S]*?\\)\\s+to anon;`,
          "u",
        ),
      );
      expect(workerRoute).toContain(`"${name}"`);
    }

    expect(migration).toContain(
      "revoke execute on function public.push_worker_is_authorized(text)\nfrom public, anon, authenticated",
    );
  });

  it("keeps every cross-user worker RPC SECURITY DEFINER and authorization-first", () => {
    for (const name of workerFunctions) {
      const sql = definition(name);
      const authorization = sql.indexOf(
        "if not public.push_worker_is_authorized(p_worker_secret)",
      );
      const firstPrivateTable = sql.search(
        /(?:from|insert into|update)\s+public\.(?:bottles|hydration_events|hydration_goals|hydration_notification_preferences|hydration_reminder_state|profiles|push_notification_outbox|web_push_subscriptions)/u,
      );

      expect(sql).toContain("security definer");
      expect(sql).toContain("set search_path = ''");
      expect(authorization).toBeGreaterThan(-1);
      expect(firstPrivateTable).toBeGreaterThan(authorization);
      expect(sql).not.toMatch(
        /\bexecute\s+(?:format|immediate)|\bformat\s*\(/iu,
      );
    }
  });

  it("gives anon no direct private-table privileges", () => {
    for (const table of [
      "hydration_notification_preferences",
      "hydration_reminder_state",
      "push_notification_outbox",
      "web_push_subscriptions",
    ]) {
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
      expect(migration).not.toMatch(
        new RegExp(`grant [^;]+ on (?:table )?public\\.${table} to anon`, "iu"),
      );
    }
  });

  it("validates only the bounded worker secret against Vault", () => {
    const helperStart = migration.indexOf(
      "create or replace function public.push_worker_is_authorized",
    );
    const helperEnd = migration.indexOf("\n$$;", helperStart);
    const helper = migration.slice(helperStart, helperEnd + 4);

    expect(helper).toContain("security definer");
    expect(helper).toContain("set search_path = ''");
    expect(helper).toContain("p_worker_secret ~ '^[0-9a-fA-F]{64}$'");
    expect(helper).toContain("from vault.decrypted_secrets");
    expect(helper).toContain("hydropop_push_worker_secret");
    expect(helper).not.toContain("select decrypted_secrets.decrypted_secret");
  });

  it("preserves concurrency controls and bounded worker responses", () => {
    expect(migration).toContain(
      "constraint push_notification_outbox_dedupe_key_key unique (dedupe_key)",
    );
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("evaluation_token = v_token");
    expect(workerRoute).toContain("evaluationBatchSchema");
    expect(workerRoute).toContain("deliveryBatchSchema");
    expect(workerRoute).toContain("delivered,");
    expect(workerRoute).toContain("enqueued,");
    expect(workerRoute).toContain("evaluated:");
    expect(workerRoute).toContain("processed:");
  });

  it("keeps browser Push writes owner-scoped and diagnostics secret-free", () => {
    expect(preferenceRoute).toContain(
      'rpc("set_hydration_notification_preferences"',
    );
    expect(subscriptionRoute).toContain('"register_web_push_subscription"');
    expect(workerRoute).not.toMatch(
      /console\.(?:log|error)\([^)]*(?:secret|endpoint|p256dh|auth|user_id)/iu,
    );
    expect(workerRoute).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

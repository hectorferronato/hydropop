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
const worker = readFileSync(
  join(root, "app/api/internal/push-reminders/run/route.ts"),
  "utf8",
);
const subscriptionRoute = readFileSync(
  join(root, "app/api/v1/push-subscriptions/route.ts"),
  "utf8",
);
const template = readFileSync(
  join(root, "supabase/templates/push-reminders-cron.sql.example"),
  "utf8",
);

function definition(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}`);
  const end = migration.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing function ${name}`);
  return migration.slice(start, end + 4);
}

describe("Web Push reminder migration and worker", () => {
  it("creates the four bounded persistence models without destructive history changes", () => {
    for (const table of [
      "web_push_subscriptions",
      "hydration_notification_preferences",
      "hydration_reminder_state",
      "push_notification_outbox",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(migration).not.toMatch(
      /\b(?:drop table|truncate|delete from auth\.|alter table auth\.)\b/iu,
    );
  });

  it("allows owners to manage only subscriptions and preferences", () => {
    expect(migration).toContain(
      'create policy "users read their own push subscriptions"',
    );
    expect(migration).toContain("(select auth.uid()) = user_id");
    expect(migration).not.toContain(
      "grant delete on table public.web_push_subscriptions",
    );
    expect(migration).toContain(
      "revoke all on table public.hydration_reminder_state from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on table public.push_notification_outbox from public, anon, authenticated",
    );
    expect(migration).toContain("where preferences.pace_reminders_enabled");
  });

  it("uses narrow Vault-authenticated SECURITY DEFINER worker RPCs", () => {
    for (const name of [
      "claim_push_reminder_evaluations",
      "apply_push_reminder_evaluation",
      "claim_push_notification_outbox",
      "complete_push_notification_outbox",
    ]) {
      const sql = definition(name);
      expect(sql).toContain("security definer");
      expect(sql).toContain("set search_path = ''");
      expect(sql).toContain("public.push_worker_is_authorized");
      expect(sql).not.toContain("execute ");
    }
    expect(migration).toContain("from vault.decrypted_secrets");
    expect(migration).toContain("hydropop_push_worker_secret");
    expect(migration).not.toContain("REPLACE_WITH_THE_SAME_256_BIT");
    expect(migration).not.toContain("service_role");
  });

  it("reconstructs only effective non-future hydration with date-effective goals", () => {
    const claim = definition("claim_push_reminder_evaluations");
    expect(claim).toContain("hydration_events.occurred_at <= p_now");
    expect(claim).toContain("hydration_events.event_type <> 'event_reversed'");
    expect(claim).toContain(
      "reversals.reverses_event_id = hydration_events.id",
    );
    expect(claim).toContain("hydration_goals.effective_from <= v_local_date");
    expect(claim).toContain(
      "hydration_events.occurred_at at time zone v_candidate.timezone",
    );
    expect(claim).toContain("else hydration_events.volume_ml");
  });

  it("serializes evaluation and delivery claims and deduplicates the outbox", () => {
    expect(migration).toContain(
      "constraint push_notification_outbox_dedupe_key_key unique (dedupe_key)",
    );
    expect(migration).toContain("evaluation_token = v_token");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain(
      "v_outbox_sequence := v_state.outbox_sequence + 1",
    );
    expect(migration).toContain("pending_outbox_id = v_outbox_id");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("limit 10");
  });

  it("advances the daily cap only after at least one device accepts delivery", () => {
    const complete = definition("complete_push_notification_outbox");
    expect(complete).toContain("if p_accepted_count > 0 then");
    expect(complete).toContain("reminder_count = least(4, reminder_count + 1)");
    expect(complete).toContain(
      "id = any(p_permanent_failure_subscription_ids)",
    );
    expect(complete).toContain("id = any(p_success_subscription_ids)");
    expect(complete).toContain("v_next_status := 'retry'");
    expect(complete).toContain("v_outbox.attempts < 5");
  });

  it("keeps browser input scoped and derives identity from authentication", () => {
    expect(subscriptionRoute).toContain("authentication.user.id");
    expect(subscriptionRoute).not.toContain("parsed.data.userId");
    expect(subscriptionRoute).not.toContain("service_role");
    expect(subscriptionRoute).not.toMatch(
      /console\.(?:log|error)\([^\n]*endpoint/iu,
    );
  });

  it("authenticates the POST-only worker with a constant-time comparison", () => {
    expect(worker).toContain("export async function POST");
    expect(worker).not.toContain("export async function GET");
    expect(worker).toContain("timingSafeEqual");
    expect(worker).toContain('createHash("sha256")');
    expect(worker).toContain("getPushWorkerSecret");
    expect(worker).toContain("isValidStoredPushSubscription");
    expect(worker).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("provides a placeholder-only hosted cron and pg_net template", () => {
    expect(template).toContain("*/15 * * * *");
    expect(template).toContain("net.http_post");
    expect(template).toContain("vault.create_secret");
    expect(template).toContain("REPLACE_WITH_PRODUCTION_HOST");
    expect(template).toContain("cron.unschedule");
  });

  it("does not schema-qualify PostgreSQL conditional expressions", () => {
    expect(migration).not.toMatch(
      /pg_catalog\.(?:coalesce|nullif|greatest|least)\s*\(/iu,
    );
  });
});

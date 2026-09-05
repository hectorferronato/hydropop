import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
const db = new PGlite({ extensions: { btree_gist } });
const owner = randomUUID();
const secret = "a".repeat(64);
const now = "2026-09-05T12:00:00Z";
type Candidate = {
  user_id: string;
  evaluation_token: string;
  reminder_count: number;
  today_intake_ml: number;
  last_hydration_at: string | null;
  last_pace_status: string | null;
};
type Delivery = {
  id: string;
  claim_token: string;
  subscriptions: { id: string }[];
};
async function candidates(time = now) {
  return (
    await db.query<{ data: { candidates: Candidate[] } }>(
      "select claim_push_reminder_evaluations($1,$2) data",
      [secret, time],
    )
  ).rows[0]!.data.candidates;
}
async function apply(c: Candidate, send = true, status = "behind") {
  return (
    await db.query<{ data: { enqueued: boolean } }>(
      "select apply_push_reminder_evaluation($1,$2,$3,$4,$5,'Water','Water break',$6,'eligible',null) data",
      [secret, c.user_id, c.evaluation_token, status, send, now],
    )
  ).rows[0]!.data;
}
async function claim(time = now) {
  return (
    await db.query<{ data: { deliveries: Delivery[] } }>(
      "select claim_push_notification_outbox($1,$2) data",
      [secret, time],
    )
  ).rows[0]!.data.deliveries;
}
async function complete(
  d: Delivery,
  accepted: string[] = [],
  retry: string | null = null,
  dead: string[] = [],
) {
  return db.query(
    "select complete_push_notification_outbox($1,$2,$3,$4,$5::uuid[],$6::uuid[],null,$7,$8)",
    [secret, d.id, d.claim_token, accepted.length, accepted, dead, retry, now],
  );
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
 create table auth.users(id uuid primary key); create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for (const name of [
    "20260725120000_create_hydropop_schema",
    "20260725120100_add_hydropop_rls",
    "20260728130000_add_typical_fill_and_bottle_completed",
    "20260730120000_add_private_community_pilot",
    "20260804120000_add_web_push_hydration_reminders",
    "20260805121000_fix_notification_preference_updates",
    "20260904120000_add_physical_button_backend",
    "20260905120000_add_immutable_recording_edits",
    "20260905130000_adaptive_push_reminders",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}.sql`, "utf8"));
  await db.query(
    "insert into vault.decrypted_secrets values ('hydropop_push_worker_secret',$1)",
    [secret],
  );
  await db.query("insert into auth.users values ($1)", [owner]);
  await db.query(
    "insert into public.profiles(id,timezone,wake_time,target_completion_time) values ($1,'UTC','08:00','20:00') on conflict(id) do update set timezone='UTC',wake_time='08:00',target_completion_time='20:00'",
    [owner],
  );
  await db.query(
    "insert into bottles(user_id,name,capacity_ml,is_primary) values ($1,'Bottle',700,true)",
    [owner],
  );
  await db.query(
    "insert into hydration_goals(user_id,daily_goal_ml,effective_from,target_completion_time) values ($1,2400,'2020-01-01','20:00')",
    [owner],
  );
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(
    "reset role; delete from hydration_reminder_state; delete from push_notification_outbox; delete from web_push_subscriptions; delete from hydration_notification_preferences;",
  );
  await db.query(
    "insert into hydration_notification_preferences(user_id,pace_reminders_enabled) values ($1,true)",
    [owner],
  );
  for (let i = 0; i < 2; i++)
    await db.query(
      "insert into web_push_subscriptions(user_id,endpoint,endpoint_hash,p256dh,auth) values ($1,$2,$3,'test_public_key_material','test_auth_key')",
      [owner, `https://push.example.test/${i}`, String(i).repeat(64)],
    );
});
describe("adaptive push PostgreSQL RPCs", () => {
  it("enqueues due in the same invocation and rejects duplicate evaluation / claims", async () => {
    const c = (await candidates())[0]!;
    expect(c).toBeDefined();
    expect((await apply(c)).enqueued).toBe(true);
    expect((await apply(c)).enqueued).toBe(false);
    const deliveries = await claim();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.subscriptions).toHaveLength(2);
    expect(await claim()).toHaveLength(0);
    await complete(
      deliveries[0]!,
      deliveries[0]!.subscriptions.map((s) => s.id),
    );
    await complete(
      deliveries[0]!,
      deliveries[0]!.subscriptions.map((s) => s.id),
    );
    expect(
      (
        await db.query<{ reminder_count: number }>(
          "select reminder_count from hydration_reminder_state",
        )
      ).rows[0]!.reminder_count,
    ).toBe(1);
  });
  it("retries only devices not yet accepted and counts the user once", async () => {
    await apply((await candidates())[0]!);
    const first = (await claim())[0]!;
    await complete(first, [first.subscriptions[0]!.id], "2026-09-05T12:02:00Z");
    const second = (await claim("2026-09-05T12:15:00Z"))[0]!;
    expect(second.subscriptions).toHaveLength(1);
    expect(second.subscriptions[0]!.id).not.toBe(first.subscriptions[0]!.id);
    await complete(second, [second.subscriptions[0]!.id]);
    expect(
      (
        await db.query<{ reminder_count: number }>(
          "select reminder_count from hydration_reminder_state",
        )
      ).rows[0]!.reminder_count,
    ).toBe(1);
  });
  it("cancels queued opt-outs", async () => {
    await apply((await candidates())[0]!);
    await db.exec(
      "update hydration_notification_preferences set pace_reminders_enabled=false",
    );
    expect(await claim()).toHaveLength(0);
  });
  it("recovers stale claims but abandons exhausted claims", async () => {
    await apply((await candidates())[0]!);
    await claim();
    expect(await claim("2026-09-05T12:16:00Z")).toHaveLength(1);
    await db.exec("update push_notification_outbox set attempts=5");
    expect(await claim("2026-09-05T12:32:00Z")).toHaveLength(0);
    expect(
      (
        await db.query<{ pending_outbox_id: string | null }>(
          "select pending_outbox_id from hydration_reminder_state",
        )
      ).rows[0]!.pending_outbox_id,
    ).toBeNull();
  });
  it("retires only expired subscriptions and resets the local-day cap", async () => {
    await apply((await candidates())[0]!);
    const d = (await claim())[0]!;
    await complete(d, [d.subscriptions[0]!.id], null, [d.subscriptions[1]!.id]);
    expect(
      (
        await db.query(
          "select id from web_push_subscriptions where revoked_at is null",
        )
      ).rows,
    ).toHaveLength(1);
    expect((await candidates("2026-09-06T12:00:00Z"))[0]!.reminder_count).toBe(
      0,
    );
  });
  it("enforces owner-only preferences and secret-protected worker access", async () => {
    await expect(
      db.query("select claim_push_reminder_evaluations('wrong')"),
    ).rejects.toThrow();
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await db.exec("set role authenticated");
    await db.query(
      "select set_hydration_notification_preferences(true,'gentle')",
    );
    const result = await db.query<{ data: object }>(
      "select get_push_reminder_diagnostics() data",
    );
    expect(JSON.stringify(result.rows)).not.toContain(owner);
    await expect(
      db.query("select * from hydration_reminder_state"),
    ).rejects.toThrow();
  });
  it.each(["device", "nfc", "web"])(
    "evaluates effective %s hydration and ignores reversed/future events",
    async (source) => {
      const id = randomUUID();
      await db.query(
        "insert into hydration_events(id,user_id,bottle_id,source,event_type,volume_ml,occurred_at,idempotency_key) select $1,$2,id,$3,'bottle_completed',700,'2026-09-05T11:00:00Z',$1::uuid::text from bottles where user_id=$2",
        [id, owner, source],
      );
      await db.query(
        "insert into hydration_events(user_id,bottle_id,source,event_type,volume_ml,occurred_at,idempotency_key) select $1,id,$2,'bottle_completed',700,'2026-09-07T11:00:00Z',$3 from bottles where user_id=$1",
        [owner, source, randomUUID()],
      );
      expect((await candidates())[0]!.today_intake_ml).toBe(700);
      await db.query(
        "insert into hydration_events(user_id,bottle_id,source,event_type,volume_ml,occurred_at,idempotency_key,reverses_event_id) select $1,id,'web','event_reversed',null,'2026-09-05T11:01:00Z',$2,$3 from bottles where user_id=$1",
        [owner, randomUUID(), id],
      );
      const after = (await candidates("2026-09-05T12:15:00Z"))[0]!;
      expect(after.today_intake_ml).toBe(0);
      expect(after.last_hydration_at).toBeNull();
    },
  );
  it("ends recovery episodes and retains a new behind entry while globally cooling down", async () => {
    await apply((await candidates())[0]!, false, "on-track");
    const recovered = (await candidates("2026-09-05T12:15:00Z"))[0]!;
    expect(recovered.last_pace_status).toBe("on-track");
    await apply(recovered, false, "behind");
    const pending = (await candidates("2026-09-05T12:30:00Z"))[0]!;
    expect(pending.last_pace_status).toBe("on-track");
    await apply(pending, true, "behind");
    expect(
      (
        await db.query<{ behind_episode: number }>(
          "select behind_episode from hydration_reminder_state",
        )
      ).rows[0]!.behind_episode,
    ).toBe(1);
  });
});

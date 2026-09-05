import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const owner = "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c";
const other = "496a6d01-fc87-4bc5-b025-4d0cf0c2a92d";
const bottle = "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0";
const db = new PGlite({ extensions: { btree_gist } });
type Row = {
  id: string;
  volume_ml: number;
  source: string;
  event_type: string;
  corrects_event_id: string | null;
  occurred_at: string;
};
type Result = {
  ok: boolean;
  duplicate?: boolean;
  error_code?: string;
  event: Row;
};
async function change(
  event: string,
  action = "edit",
  key = randomUUID(),
  volume: number | null = 800,
  occurred: string | null = "2026-09-04T22:00:00Z",
) {
  const result = await db.query<{ result: Result }>(
    "select public.change_hydration_recording($1,$2,$3,$4,$5) as result",
    [
      event,
      action,
      key,
      action === "remove" ? null : volume,
      action === "remove" ? null : occurred,
    ],
  );
  return result.rows[0]!.result;
}
async function original(source = "device") {
  await db.exec("reset role");
  const id = randomUUID();
  await db.query(
    "insert into public.hydration_events(id,user_id,bottle_id,source,event_type,volume_ml,occurred_at,idempotency_key) values ($1,$2,$3,$4,'bottle_completed',887,'2026-09-05T10:00:00Z',$1::uuid::text)",
    [id, owner, bottle, source],
  );
  await login(owner);
  return id;
}
async function login(user: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
async function active() {
  return (
    await db.query<Row>(
      "select e.* from public.hydration_events e where event_type <> 'event_reversed' and not exists (select 1 from public.hydration_events r where r.reverses_event_id=e.id)",
    )
  ).rows;
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  for (const name of [
    "20260725120000_create_hydropop_schema",
    "20260725120100_add_hydropop_rls",
    "20260728130000_add_typical_fill_and_bottle_completed",
    "20260730120000_add_private_community_pilot",
    "20260804120000_add_web_push_hydration_reminders",
    "20260904120000_add_physical_button_backend",
    "20260905120000_add_immutable_recording_edits",
  ]) {
    await db.exec(readFileSync(`supabase/migrations/${name}.sql`, "utf8"));
  }
  await db.query("insert into auth.users values ($1),($2)", [owner, other]);
  await db.query(
    "insert into public.bottles(id,user_id,name,capacity_ml,is_primary) values ($1,$2,'Test',887,true)",
    [bottle, owner],
  );
  await db.query(
    "insert into public.hydration_goals(user_id,daily_goal_ml,effective_from,target_completion_time) values ($1,2000,'2020-01-01','20:00')",
    [owner],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("embedded PostgreSQL immutable recording operations", () => {
  it.each(["device", "nfc", "web"])(
    "edits %s with immutable lineage/type/source, retries, then edits and removes again",
    async (source) => {
      const id = await original(source);
      const key = randomUUID();
      const before = (
        await db.query("select * from public.hydration_events where id=$1", [
          id,
        ])
      ).rows[0];
      const first = await change(id, "edit", key);
      expect(first).toMatchObject({
        ok: true,
        duplicate: false,
        event: {
          corrects_event_id: id,
          source,
          event_type: "bottle_completed",
          volume_ml: 800,
        },
      });
      expect(await change(id, "edit", key)).toMatchObject({
        ok: true,
        duplicate: true,
        event: { id: first.event.id },
      });
      expect(await change(id, "edit", key, 700)).toMatchObject({
        ok: false,
        error_code: "INVALID_INPUT",
      });
      expect(await change(id)).toMatchObject({
        ok: false,
        error_code: "EVENT_ALREADY_REVERSED",
      });
      const second = await change(first.event.id, "edit", randomUUID(), 750);
      expect(second.event.corrects_event_id).toBe(first.event.id);
      expect(
        (await active()).filter((e) =>
          [id, first.event.id, second.event.id].includes(e.id),
        ),
      ).toEqual([expect.objectContaining({ volume_ml: 750 })]);
      const removeKey = randomUUID();
      expect(await change(second.event.id, "remove", removeKey)).toMatchObject({
        ok: true,
      });
      expect(await change(second.event.id, "remove", removeKey)).toMatchObject({
        ok: true,
        duplicate: true,
      });
      expect(await change(second.event.id, "remove")).toMatchObject({
        ok: false,
        error_code: "EVENT_ALREADY_REVERSED",
      });
      expect(
        (await active()).filter((e) =>
          [id, first.event.id, second.event.id].includes(e.id),
        ),
      ).toEqual([]);
      expect(
        (
          await db.query("select * from public.hydration_events where id=$1", [
            id,
          ])
        ).rows[0],
      ).toEqual(before);
    },
  );
  it("enforces ownership, RLS, authentication and direct mutation/lineage restrictions", async () => {
    const id = await original();
    await login(other);
    expect(await change(id)).toMatchObject({
      ok: false,
      error_code: "FORBIDDEN",
    });
    expect(await change(id, "remove")).toMatchObject({
      ok: false,
      error_code: "FORBIDDEN",
    });
    expect(
      (
        await db.query("select * from public.hydration_events where id=$1", [
          id,
        ])
      ).rows,
    ).toHaveLength(0);
    await login("");
    expect(await change(id)).toMatchObject({
      ok: false,
      error_code: "UNAUTHENTICATED",
    });
    await login(owner);
    await expect(
      db.query("update public.hydration_events set volume_ml=1 where id=$1", [
        id,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("delete from public.hydration_events where id=$1", [id]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.hydration_events(user_id,bottle_id,source,event_type,volume_ml,occurred_at,idempotency_key,corrects_event_id) values($1,$2,'web','manual_intake',800,now(),'forged',$3)",
        [owner, bottle, id],
      ),
    ).rejects.toThrow(/Corrections require/);
    await expect(
      db.query(
        "insert into public.hydration_events(user_id,bottle_id,source,event_type,volume_ml,occurred_at,idempotency_key) values($1,$2,'device','bottle_completed',800,now(),'forged-device')",
        [owner, bottle],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      (
        await db.query<{ relrowsecurity: boolean }>(
          "select relrowsecurity from pg_class where oid='public.hydration_events'::regclass",
        )
      ).rows[0]?.relrowsecurity,
    ).toBe(true);
    await db.exec("reset role; set role anon");
    await expect(change(id)).rejects.toThrow(/permission denied/);
  });
  it("rejects reversal editing and invalid amounts/timestamps before writing", async () => {
    const id = await original();
    for (const volume of [null, 0, -1, 10001])
      expect(await change(id, "edit", randomUUID(), volume)).toMatchObject({
        ok: false,
        error_code: "INVALID_INPUT",
      });
    expect(
      await change(id, "edit", randomUUID(), 800, "2100-01-01T00:00:00Z"),
    ).toMatchObject({ ok: false, error_code: "EVENT_IN_FUTURE" });
    expect(
      await change(id, "edit", randomUUID(), 800, "infinity"),
    ).toMatchObject({ ok: false, error_code: "INVALID_INPUT" });
    const removed = await change(id, "remove");
    expect(await change(removed.event.id)).toMatchObject({
      ok: false,
      error_code: "FORBIDDEN",
    });
  });
  it("rolls back reversal if replacement insertion fails", async () => {
    const id = await original();
    await db.exec(`reset role;
      create function public.fail_test_replacement() returns trigger language plpgsql as $$ begin
        if new.corrects_event_id is not null then raise exception 'Injected replacement failure'; end if; return new; end $$;
      create trigger test_replacement_failure before insert on public.hydration_events for each row execute function public.fail_test_replacement();`);
    await login(owner);
    await expect(change(id)).rejects.toThrow(/Injected replacement failure/);
    expect((await active()).some((e) => e.id === id)).toBe(true);
    expect(
      (
        await db.query(
          "select * from public.hydration_events where reverses_event_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec(
      "reset role; drop trigger test_replacement_failure on public.hydration_events; drop function public.fail_test_replacement()",
    );
  });

  it("Community and the next reminder evaluation see corrected and removed totals", async () => {
    const id = await original();
    const instant = new Date(Date.now() - 60000).toISOString();
    const edited = await change(id, "edit", randomUUID(), 623, instant);
    await db.exec("reset role");
    const secret = "a".repeat(64); // In-memory fixture only; no real credentials.
    await db.query(
      "insert into vault.decrypted_secrets values ('hydropop_push_worker_secret',$1)",
      [secret],
    );
    await db.query(
      "insert into public.hydration_notification_preferences(user_id,pace_reminders_enabled) values($1,true)",
      [owner],
    );
    await db.query(
      "insert into public.web_push_subscriptions(user_id,endpoint,endpoint_hash,p256dh,auth) values($1,'https://example.invalid/push',$2,$3,$4)",
      [owner, "b".repeat(64), "c".repeat(32), "d".repeat(16)],
    );
    async function totals() {
      await db.exec("reset role");
      const aggregate = await db.query<{
        intake_ml: number;
        completed_bottles: number;
      }>(
        "select * from public.community_member_daily_aggregate($1,(now() at time zone 'America/New_York')::date,(now() at time zone 'America/New_York')::date)",
        [owner],
      );
      // Simulate the next normal worker evaluation; do not enqueue/send anything.
      await db.exec(
        "update public.hydration_reminder_state set last_evaluated_at=null",
      );
      const push = await db.query<{
        result: { candidates: { today_intake_ml: number }[] };
      }>(
        "select public.claim_push_reminder_evaluations($1,now(),50) as result",
        [secret],
      );
      return {
        intake: Number(aggregate.rows[0]!.intake_ml),
        bottles: Number(aggregate.rows[0]!.completed_bottles),
        push: push.rows[0]!.result.candidates[0]!.today_intake_ml,
      };
    }
    const before = await totals();
    await login(owner);
    expect(await change(edited.event.id, "remove")).toMatchObject({ ok: true });
    const after = await totals();
    expect(before.intake - after.intake).toBe(623);
    expect(before.bottles - after.bottles).toBe(1);
    expect(before.push - after.push).toBe(623);
    expect(
      (await db.query("select * from public.push_notification_outbox")).rows,
    ).toHaveLength(0);
  });

  it("leaves ordinary completed-bottle endpoints unable to override volume or claim device source", async () => {
    await login(owner);
    const sql =
      "select public.process_hydration_event($1,'bottle_completed',now(),$2,$3,$4) as result";
    for (const [source, volume] of [
      ["web", 800],
      ["nfc", 800],
      ["device", null],
    ] as const) {
      expect(
        (
          await db.query<{ result: Result }>(sql, [
            bottle,
            randomUUID(),
            source,
            volume,
          ])
        ).rows[0]?.result,
      ).toMatchObject({ ok: false, error_code: "INVALID_INPUT" });
    }
  });
});

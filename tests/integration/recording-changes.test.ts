import { describe, expect, it, vi } from "vitest";
import { changeHydrationRecording } from "@/lib/application/hydration/change-hydration-recording";
import {
  buildTodayDashboard,
  buildCalendarSummary,
} from "@/lib/application/hydration/hydration-projection";
import {
  buildTrendsSummary,
  buildPrivateProfileSummary,
} from "@/lib/application/analytics/hydration-analytics";
import { reconstructEffectiveEvents } from "@/lib/domain/hydration/effective-events";
import {
  effectiveRecordingHistory,
  recordingSourceLabel,
} from "@/lib/domain/hydration/recording-history";
import {
  now,
  original,
  snapshot,
  reverse,
  eventId,
} from "../fixtures/recordings";

const input = {
  action: "edit",
  eventId,
  idempotencyKey: "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c",
  amount: 800,
  unit: "ml",
  date: "2026-09-04",
  time: "21:45:00",
};
function execute() {
  return vi.fn(async () => ({
    error: null,
    data: { ok: true, duplicate: false, event: { id: eventId } },
  }));
}

describe("recording changes", () => {
  it.each([
    ["web", "App"],
    ["nfc", "NFC"],
    ["device", "Physical button"],
  ] as const)(
    "preserves %s provenance through repeated edits",
    (source, label) => {
      expect(recordingSourceLabel({ ...original, source })).toBe(label);
      expect(
        recordingSourceLabel({ ...original, source, correctsEventId: eventId }),
      ).toBe(`${label} · Edited`);
    },
  );
  it("converts ounces on the server and uses the member timezone", async () => {
    const rpc = execute();
    await changeHydrationRecording({
      input: { ...input, amount: 30, unit: "oz" },
      snapshot: snapshot(),
      execute: rpc,
      now,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith({
      p_action: "edit",
      p_event_id: eventId,
      p_idempotency_key: input.idempotencyKey,
      p_volume_ml: 887,
      p_occurred_at: "2026-09-05T01:45:00.000Z",
    });
  });
  it.each([0, -1, NaN, Infinity, 10001, 0.00001])(
    "rejects invalid amount %s",
    async (amount) => {
      const rpc = execute();
      await expect(
        changeHydrationRecording({
          input: { ...input, amount },
          snapshot: snapshot(),
          execute: rpc,
          now,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it.each([
    "source",
    "userId",
    "eventType",
    "originalSource",
    "metadata",
    "bottleId",
  ])("rejects client-controlled %s", async (field) => {
    const rpc = execute();
    await expect(
      changeHydrationRecording({
        input: { ...input, [field]: "forged" },
        snapshot: snapshot(),
        execute: rpc,
        now,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["2026-09-06", "2026-02-30", "2010-01-01"])(
    "rejects future/invalid/ancient dates %s",
    async (date) => {
      await expect(
        changeHydrationRecording({
          input: { ...input, date },
          snapshot: snapshot(),
          execute: execute(),
          now,
        }),
      ).rejects.toThrow();
    },
  );
  it("rejects nonexistent DST time", async () => {
    await expect(
      changeHydrationRecording({
        input: { ...input, date: "2026-03-08", time: "02:30:00" },
        snapshot: snapshot(),
        execute: execute(),
        now,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("preserves the second occurrence of an unchanged repeated DST hour", async () => {
    const rpc = execute();
    await changeHydrationRecording({
      input: { ...input, date: "2026-11-01", time: "01:30:00" },
      snapshot: snapshot([{ ...original, occurredAt: "2026-11-01T06:30:00Z" }]),
      execute: rpc,
      now: new Date("2026-11-02T00:00:00Z"),
    });
    expect(rpc.mock.calls[0]).toEqual([
      expect.objectContaining({ p_occurred_at: "2026-11-01T06:30:00.000Z" }),
    ]);
  });
  it.each(["edit", "remove"])(
    "rejects %s of an event outside the owner snapshot",
    async (action) => {
      await expect(
        changeHydrationRecording({
          input:
            action === "edit"
              ? input
              : { action, eventId, idempotencyKey: input.idempotencyKey },
          snapshot: snapshot([]),
          execute: execute(),
          now,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    },
  );
  it("passes removal as one atomic operation with no replacement values", async () => {
    const rpc = execute();
    await changeHydrationRecording({
      input: {
        action: "remove",
        eventId,
        idempotencyKey: input.idempotencyKey,
      },
      snapshot: snapshot(),
      execute: rpc,
      now,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith({
      p_action: "remove",
      p_event_id: eventId,
      p_idempotency_key: input.idempotencyKey,
    });
  });
  it("projects one effective corrected bottle across Today, Calendar, Trends, Profile and pace", () => {
    const edited = {
      ...original,
      id: "second",
      correctsEventId: original.id,
      volumeMl: 800,
    };
    const final = {
      ...edited,
      id: "third",
      correctsEventId: edited.id,
      volumeMl: 750,
      occurredAt: "2026-09-05T01:45:00Z",
    };
    const data = snapshot([
      original,
      reverse(original),
      edited,
      reverse(edited),
      final,
    ]);
    const history = reconstructEffectiveEvents(data.events);
    expect(effectiveRecordingHistory(history.timeline)).toEqual([
      expect.objectContaining({ id: "third", volumeMl: 750, source: "device" }),
    ]);
    const today = buildTodayDashboard(data, now);
    expect(today.daySummary.consumedMl).toBe(0);
    expect(today.daySummary.completedBottleCount).toBe(0);
    expect(today.coaching).toEqual(
      buildTodayDashboard(snapshot([]), now).coaching,
    );
    const day = buildCalendarSummary(data, "2026-09").days.find(
      (d) => d.date === "2026-09-04",
    )!;
    expect(day.consumedMl).toBe(750);
    expect(day.completedBottleCount).toBe(1);
    expect(effectiveRecordingHistory(day.timeline)).toHaveLength(1);
    expect(buildPrivateProfileSummary(data, now)).toMatchObject({
      lifetimeHydrationMl: 750,
      totalCompletedBottles: 1,
    });
    expect(
      buildTrendsSummary(data, 7, now).days.find((d) => d.date === "2026-09-04")
        ?.intakeMl,
    ).toBe(750);
    const removed = snapshot([...data.events, reverse(final)]);
    expect(
      effectiveRecordingHistory(
        reconstructEffectiveEvents(removed.events).timeline,
      ),
    ).toEqual([]);
    expect(buildPrivateProfileSummary(removed, now)).toMatchObject({
      lifetimeHydrationMl: 0,
      totalCompletedBottles: 0,
    });
    expect(original.volumeMl).toBe(887);
  });
});

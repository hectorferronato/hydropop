import { describe, expect, it, vi } from "vitest";

import { buildTodayDashboard } from "@/lib/application/hydration/hydration-projection";
import type { AtomicHydrationEventExecutor } from "@/lib/application/hydration/process-hydration-event";
import {
  calculateHalfManualVolumeMl,
  recordManualHydration,
} from "@/lib/application/hydration/record-manual-hydration";
import type { HydrationEvent } from "@/lib/domain/hydration/event-types";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

const now = new Date("2026-08-02T16:00:00.000Z");
const userId = "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c";
const bottleId = "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0";
const eventId = "bfdb4a6d-f46c-43c0-8ae1-8047e12b2e95";
const idempotencyKey = "manual-hydration-key-0001";

function event(
  eventType: HydrationEvent["eventType"],
  volumeMl: number,
): HydrationEvent {
  return {
    bottleId,
    createdAt: now.toISOString(),
    deviceId: null,
    eventType,
    id: eventId,
    idempotencyKey,
    metadata: { effective_credited_ml: volumeMl },
    occurredAt: now.toISOString(),
    receivedAt: now.toISOString(),
    reversesEventId: null,
    source: "web",
    userId,
    volumeMl,
  };
}

function snapshot({
  events = [],
  typicalFillMl = 650,
}: {
  events?: HydrationEvent[];
  typicalFillMl?: number | null;
} = {}): HydrationSnapshot {
  const bottle = {
    archived_at: null,
    capacity_ml: 710,
    id: bottleId,
    is_primary: true,
    name: "Work bottle",
    typical_fill_ml: typicalFillMl,
  };

  return {
    bottles: [bottle],
    events,
    goals: [
      {
        created_at: "2026-07-01T00:00:00.000Z",
        daily_goal_ml: 2_130,
        effective_from: "2026-07-01",
        effective_until: null,
        id: "goal-1",
        target_completion_time: "20:00:00",
      },
    ],
    primaryBottle: bottle,
    profile: {
      display_name: "Bea",
      preferred_unit: "oz",
      target_completion_time: "20:00:00",
      timezone: "America/New_York",
      wake_time: "07:00:00",
    },
  };
}

function eventRow(eventType: HydrationEvent["eventType"], volumeMl: number) {
  return {
    bottle_id: bottleId,
    created_at: now.toISOString(),
    device_id: null,
    event_type: eventType,
    id: eventId,
    idempotency_key: idempotencyKey,
    metadata: { effective_credited_ml: volumeMl },
    occurred_at: now.toISOString(),
    received_at: now.toISOString(),
    reverses_event_id: null,
    source: "web",
    user_id: userId,
    volume_ml: volumeMl,
  };
}

function dependencies({
  duplicate = false,
  eventType = "bottle_completed" as HydrationEvent["eventType"],
  initialSnapshot = snapshot(),
  volumeMl = 650,
} = {}) {
  const updatedSnapshot = snapshot({ events: [event(eventType, volumeMl)] });
  const executeAtomicEvent = vi.fn<AtomicHydrationEventExecutor>(async () => ({
    data: { duplicate, event: eventRow(eventType, volumeMl), ok: true },
    error: null,
  }));

  return {
    executeAtomicEvent,
    getHydrationSnapshot: vi.fn(async () => initialSnapshot),
    getUpdatedDashboard: vi.fn(async () =>
      buildTodayDashboard(updatedSnapshot, now),
    ),
  };
}

function input(
  action: "full" | "half",
  overrides: Record<string, unknown> = {},
) {
  return {
    action,
    idempotencyKey,
    occurredAt: now.toISOString(),
    ...overrides,
  };
}

describe("manual hydration recording", () => {
  it("records a full bottle against the server-resolved primary bottle", async () => {
    const deps = dependencies();
    const result = await recordManualHydration({
      ...deps,
      input: input("full"),
      now,
    });

    expect(deps.executeAtomicEvent).toHaveBeenCalledWith({
      p_bottle_id: bottleId,
      p_event_type: "bottle_completed",
      p_idempotency_key: idempotencyKey,
      p_occurred_at: now.toISOString(),
      p_source: "web",
    });
    expect(result).toMatchObject({
      amountRecordedMl: 650,
      completedBottleCount: 1,
      isNew: true,
      semantic: "full",
      updatedDailyTotalMl: 650,
    });
  });

  it("calculates half from typical fill on the server without completing a bottle", async () => {
    const deps = dependencies({
      eventType: "manual_intake",
      volumeMl: 325,
    });
    const result = await recordManualHydration({
      ...deps,
      input: input("half"),
      now,
    });

    expect(calculateHalfManualVolumeMl(650)).toBe(325);
    expect(deps.executeAtomicEvent).toHaveBeenCalledWith({
      p_bottle_id: bottleId,
      p_event_type: "manual_intake",
      p_idempotency_key: idempotencyKey,
      p_occurred_at: now.toISOString(),
      p_source: "web",
      p_volume_ml: 325,
    });
    expect(result.completedBottleCount).toBe(0);
    expect(result.semantic).toBe("half");
  });

  it("falls back to half the capacity and rounds server-side", async () => {
    const initialSnapshot = snapshot({ typicalFillMl: null });
    const deps = dependencies({
      eventType: "manual_intake",
      initialSnapshot,
      volumeMl: 355,
    });

    await recordManualHydration({
      ...deps,
      input: input("half"),
      now,
    });

    expect(deps.executeAtomicEvent).toHaveBeenCalledWith(
      expect.objectContaining({ p_volume_ml: 355 }),
    );
    expect(calculateHalfManualVolumeMl(651)).toBe(326);
  });

  it.each([
    { bottleId },
    { userId },
    { volumeMl: 999 },
    { source: "nfc" },
    { eventType: "adjustment" },
  ])("rejects browser-supplied authoritative data: %o", async (extra) => {
    const deps = dependencies();

    await expect(
      recordManualHydration({
        ...deps,
        input: input("full", extra),
        now,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(deps.executeAtomicEvent).not.toHaveBeenCalled();
  });

  it("returns a persisted idempotent replay without declaring a new event", async () => {
    const existing = event("bottle_completed", 650);
    const deps = dependencies({
      duplicate: true,
      initialSnapshot: snapshot({ events: [existing] }),
    });
    const result = await recordManualHydration({
      ...deps,
      input: input("full"),
      now,
    });

    expect(deps.executeAtomicEvent).toHaveBeenCalledOnce();
    expect(result.isNew).toBe(false);
    expect(result.updatedDailyTotalMl).toBe(650);
  });

  it("keeps half intake reversible and excluded from completed bottles", () => {
    const half = event("manual_intake", 325);
    const reversal: HydrationEvent = {
      ...event("event_reversed", 0),
      id: "reversal-id",
      idempotencyKey: "manual-half-reversal",
      occurredAt: "2026-08-02T16:01:00.000Z",
      reversesEventId: half.id,
      volumeMl: null,
    };
    const summary = buildTodayDashboard(
      snapshot({ events: [half, reversal] }),
      now,
    ).daySummary;

    expect(summary.consumedMl).toBe(0);
    expect(summary.completedBottleCount).toBe(0);
  });
});

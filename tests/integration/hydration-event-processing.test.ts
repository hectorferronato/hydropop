import { describe, expect, it, vi } from "vitest";

import { buildTodayDashboard } from "@/lib/application/hydration/hydration-projection";
import {
  processHydrationEvent,
  type AtomicHydrationEventExecutor,
} from "@/lib/application/hydration/process-hydration-event";
import { HydrationApplicationError } from "@/lib/contracts/api-response";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

const now = new Date("2026-07-28T16:00:00.000Z");
const bottleId = "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0";
const userId = "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c";

const eventRow = {
  bottle_id: bottleId,
  created_at: now.toISOString(),
  device_id: null,
  event_type: "fill_started",
  id: "bfdb4a6d-f46c-43c0-8ae1-8047e12b2e95",
  idempotency_key: "event-key-0001",
  metadata: { bottle_capacity_ml: 710 },
  occurred_at: now.toISOString(),
  received_at: now.toISOString(),
  reverses_event_id: null,
  source: "web",
  user_id: userId,
  volume_ml: 0,
};

function configuredSnapshot(): HydrationSnapshot {
  return {
    events: [],
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
    primaryBottle: {
      capacity_ml: 710,
      id: bottleId,
      is_primary: true,
      name: "Daily bottle",
    },
    profile: {
      display_name: "Bea",
      preferred_unit: "oz",
      target_completion_time: "20:00:00",
      timezone: "America/New_York",
      wake_time: "07:00:00",
    },
  };
}

function validInput() {
  return {
    bottleId,
    eventType: "fill_started",
    idempotencyKey: eventRow.idempotency_key,
    occurredAt: now.toISOString(),
    source: "web",
  };
}

function successfulExecutor(duplicate = false): AtomicHydrationEventExecutor {
  return vi.fn(async () => ({
    data: { duplicate, event: eventRow, ok: true },
    error: null,
  }));
}

async function expectRpcError(code: string) {
  const executeAtomicEvent: AtomicHydrationEventExecutor = vi.fn(async () => ({
    data: { error_code: code, ok: false },
    error: null,
  }));

  await expect(
    processHydrationEvent({
      executeAtomicEvent,
      getUpdatedDashboard: async () =>
        buildTodayDashboard(configuredSnapshot(), now),
      input: validInput(),
      now,
    }),
  ).rejects.toMatchObject({ code });
}

describe("authoritative hydration event application service", () => {
  it("creates an authenticated event without accepting a user ID", async () => {
    const executeAtomicEvent = successfulExecutor();
    const result = await processHydrationEvent({
      executeAtomicEvent,
      getUpdatedDashboard: async () =>
        buildTodayDashboard(configuredSnapshot(), now),
      input: validInput(),
      now,
    });

    expect(result.event.userId).toBe(userId);
    expect(executeAtomicEvent).toHaveBeenCalledWith(
      expect.not.objectContaining({ p_user_id: expect.anything() }),
    );
    expect(result.duplicate).toBe(false);
  });

  it("returns the original successful event for duplicate idempotency", async () => {
    const getUpdatedDashboard = vi.fn(async () =>
      buildTodayDashboard(configuredSnapshot(), now),
    );
    const result = await processHydrationEvent({
      executeAtomicEvent: successfulExecutor(true),
      getUpdatedDashboard,
      input: validInput(),
      now,
    });

    expect(result.duplicate).toBe(true);
    expect(result.event.id).toBe(eventRow.id);
    expect(getUpdatedDashboard).toHaveBeenCalledOnce();
    expect(result.daySummary.date).toBe("2026-07-28");
  });

  it("passes a device only when one was supplied", async () => {
    const executeAtomicEvent = successfulExecutor();
    const deviceId = "91aa196f-bf1e-4336-9a15-72613205012e";

    await processHydrationEvent({
      executeAtomicEvent,
      getUpdatedDashboard: async () =>
        buildTodayDashboard(configuredSnapshot(), now),
      input: { ...validInput(), deviceId },
      now,
    });

    expect(executeAtomicEvent).toHaveBeenCalledWith(
      expect.objectContaining({ p_device_id: deviceId }),
    );
  });

  it("maps another user's bottle to a stable bottle error", async () => {
    await expectRpcError("BOTTLE_NOT_FOUND");
  });

  it("maps another user's device to a stable device error", async () => {
    await expectRpcError("DEVICE_NOT_FOUND");
  });

  it("rejects finishing without an active bottle cycle", async () => {
    await expectRpcError("NO_ACTIVE_BOTTLE_CYCLE");
  });

  it("rejects attempting to reverse the same event twice", async () => {
    await expectRpcError("EVENT_ALREADY_REVERSED");
  });

  it("rejects attempting to reverse another user's event", async () => {
    await expectRpcError("INVALID_REVERSAL");
  });

  it("rejects malformed manual intake before calling the database", async () => {
    const executeAtomicEvent = successfulExecutor();

    await expect(
      processHydrationEvent({
        executeAtomicEvent,
        getUpdatedDashboard: async () =>
          buildTodayDashboard(configuredSnapshot(), now),
        input: {
          ...validInput(),
          eventType: "manual_intake",
          volumeMl: -10,
        },
        now,
      }),
    ).rejects.toBeInstanceOf(HydrationApplicationError);
    expect(executeAtomicEvent).not.toHaveBeenCalled();
  });

  it("returns updated day summary and coaching from the server projection", async () => {
    const result = await processHydrationEvent({
      executeAtomicEvent: successfulExecutor(),
      getUpdatedDashboard: async () =>
        buildTodayDashboard(configuredSnapshot(), now),
      input: validInput(),
      now,
    });

    expect(result.daySummary.date).toBe("2026-07-28");
    expect(result.coaching.status).toBeDefined();
  });
});

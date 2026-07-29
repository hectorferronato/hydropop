import { describe, expect, it, vi } from "vitest";

import { buildTodayDashboard } from "@/lib/application/hydration/hydration-projection";
import type { AtomicHydrationEventExecutor } from "@/lib/application/hydration/process-hydration-event";
import {
  calculateHalfNfcVolumeMl,
  completeNfcBottle,
  hasRecentEffectiveCompletion,
} from "@/lib/application/nfc/complete-nfc-bottle";
import type { NfcScanResolution } from "@/lib/application/nfc/resolve-nfc-scan";
import { HydrationApplicationError } from "@/lib/contracts/api-response";
import type { HydrationEvent } from "@/lib/domain/hydration/event-types";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

const now = new Date("2026-07-28T16:00:00.000Z");
const userId = "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c";
const bottleId = "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0";
const tagId = "91aa196f-bf1e-4336-9a15-72613205012e";
const eventId = "bfdb4a6d-f46c-43c0-8ae1-8047e12b2e95";
const token = "A".repeat(43);
const idempotencyKey = "nfc-confirmation-key-0001";

const resolution: NfcScanResolution = {
  bottle: {
    archivedAt: null,
    brand: "Owala",
    capacityMl: 710,
    id: bottleId,
    isPrimary: true,
    model: "FreeSip",
    name: "Work bottle",
    typicalFillMl: 650,
    userId,
  },
  normalFillMl: 650,
  tag: {
    bottleId,
    friendlyCode: "bea-kitchen",
    id: tagId,
    label: "Kitchen",
    lastConfirmedAt: null,
    status: "active",
    userId,
  },
};

function hydrationEvent(
  overrides: Partial<HydrationEvent> = {},
): HydrationEvent {
  return {
    bottleId,
    createdAt: now.toISOString(),
    deviceId: null,
    eventType: "bottle_completed",
    id: eventId,
    idempotencyKey,
    metadata: {
      bottle_capacity_ml: 710,
      effective_credited_ml: 650,
      typical_fill_ml: 650,
    },
    occurredAt: now.toISOString(),
    receivedAt: now.toISOString(),
    reversesEventId: null,
    source: "nfc",
    userId,
    volumeMl: 650,
    ...overrides,
  };
}

function snapshot(events: HydrationEvent[] = []): HydrationSnapshot {
  const bottle = {
    archived_at: null,
    capacity_ml: 710,
    id: bottleId,
    is_primary: true,
    name: "Work bottle",
    typical_fill_ml: 650,
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

function eventRow(
  volumeMl = 650,
  eventType: HydrationEvent["eventType"] = "bottle_completed",
) {
  return {
    bottle_id: bottleId,
    created_at: now.toISOString(),
    device_id: null,
    event_type: eventType,
    id: eventId,
    idempotency_key: idempotencyKey,
    metadata: {
      bottle_capacity_ml: 710,
      effective_credited_ml: volumeMl,
      typical_fill_ml: volumeMl === 710 ? null : volumeMl,
    },
    occurred_at: now.toISOString(),
    received_at: now.toISOString(),
    reverses_event_id: null,
    source: "nfc",
    user_id: userId,
    volume_ml: volumeMl,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey,
    occurredAt: now.toISOString(),
    identifier: token,
    ...overrides,
  };
}

function dependencies({
  duplicate = false,
  eventType = "bottle_completed",
  preSnapshot = snapshot(),
  resolved = resolution,
  volumeMl = 650,
}: {
  duplicate?: boolean;
  eventType?: HydrationEvent["eventType"];
  preSnapshot?: HydrationSnapshot;
  resolved?: NfcScanResolution | null;
  volumeMl?: number;
} = {}) {
  const updatedSnapshot = snapshot([hydrationEvent({ eventType, volumeMl })]);
  const executeAtomicEvent = vi.fn<AtomicHydrationEventExecutor>(async () => ({
    data: { duplicate, event: eventRow(volumeMl, eventType), ok: true },
    error: null,
  }));
  const markConfirmed = vi.fn(async () => "2026-07-28T16:00:01.000Z");

  return {
    executeAtomicEvent,
    getHydrationSnapshot: vi.fn(async () => preSnapshot),
    getUpdatedDashboard: vi.fn(async () =>
      buildTodayDashboard(updatedSnapshot, now),
    ),
    markConfirmed,
    resolveIdentifier: vi.fn(async () => resolved),
  };
}

describe("NFC bottle completion integration", () => {
  it("creates exactly one bottle_completed event using source nfc", async () => {
    const deps = dependencies();
    const result = await completeNfcBottle({
      ...deps,
      input: validInput(),
      now,
    });

    expect(deps.executeAtomicEvent).toHaveBeenCalledOnce();
    expect(deps.executeAtomicEvent).toHaveBeenCalledWith({
      p_bottle_id: bottleId,
      p_event_type: "bottle_completed",
      p_idempotency_key: idempotencyKey,
      p_occurred_at: now.toISOString(),
      p_source: "nfc",
    });
    expect(result.creditedAmountMl).toBe(650);
    expect(result.action).toBe("full");
    expect(result.daySummary.consumedMl).toBe(650);
    expect(result.daySummary.completedBottleCount).toBe(1);
  });

  it("returns the typical-fill amount snapshotted by the processor", async () => {
    const result = await completeNfcBottle({
      ...dependencies({ volumeMl: 650 }),
      input: validInput(),
      now,
    });

    expect(result.event.volumeMl).toBe(650);
    expect(result.creditedAmountMl).toBe(650);
  });

  it("returns the capacity fallback snapshotted by the processor", async () => {
    const result = await completeNfcBottle({
      ...dependencies({ volumeMl: 710 }),
      input: validInput(),
      now,
    });

    expect(result.event.volumeMl).toBe(710);
    expect(result.creditedAmountMl).toBe(710);
  });

  it("records half the normal fill as manual intake without completing a bottle", async () => {
    const deps = dependencies({
      eventType: "manual_intake",
      volumeMl: 325,
    });
    const result = await completeNfcBottle({
      ...deps,
      input: validInput({ action: "half" }),
      now,
    });

    expect(calculateHalfNfcVolumeMl(resolution.normalFillMl)).toBe(325);
    expect(deps.executeAtomicEvent).toHaveBeenCalledWith({
      p_bottle_id: bottleId,
      p_event_type: "manual_intake",
      p_idempotency_key: idempotencyKey,
      p_occurred_at: now.toISOString(),
      p_source: "nfc",
      p_volume_ml: 325,
    });
    expect(result.action).toBe("half");
    expect(result.creditedAmountMl).toBe(325);
    expect(result.daySummary.consumedMl).toBe(325);
    expect(result.daySummary.completedBottleCount).toBe(0);
    expect(deps.markConfirmed).not.toHaveBeenCalled();
  });

  it("rounds a half confirmation from the server-resolved normal fill", async () => {
    const deps = dependencies({
      eventType: "manual_intake",
      resolved: { ...resolution, normalFillMl: 651 },
      volumeMl: 326,
    });

    await completeNfcBottle({
      ...deps,
      input: validInput({ action: "half" }),
      now,
    });

    expect(deps.executeAtomicEvent).toHaveBeenCalledWith(
      expect.objectContaining({ p_volume_ml: 326 }),
    );
  });

  it("uses bottle capacity for half only when typical fill is absent", async () => {
    const deps = dependencies({
      eventType: "manual_intake",
      resolved: {
        ...resolution,
        bottle: { ...resolution.bottle, typicalFillMl: null },
        normalFillMl: 710,
      },
      volumeMl: 355,
    });

    await completeNfcBottle({
      ...deps,
      input: validInput({ action: "half" }),
      now,
    });

    expect(deps.executeAtomicEvent).toHaveBeenCalledWith(
      expect.objectContaining({ p_volume_ml: 355 }),
    );
  });

  it.each([
    { bottleId },
    { capacityMl: 999 },
    { typicalFillMl: 999 },
    { userId },
    { volumeMl: 999 },
  ])("rejects browser-supplied derived data: %o", async (derivedField) => {
    const deps = dependencies();

    await expect(
      completeNfcBottle({
        ...deps,
        input: validInput(derivedField),
        now,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(deps.executeAtomicEvent).not.toHaveBeenCalled();
  });

  it("returns the original event for duplicate idempotency", async () => {
    const existing = hydrationEvent();
    const deps = dependencies({
      duplicate: true,
      preSnapshot: snapshot([existing]),
    });
    const result = await completeNfcBottle({
      ...deps,
      input: validInput(),
      now,
    });

    expect(result.duplicate).toBe(true);
    expect(result.event.id).toBe(eventId);
    expect(deps.executeAtomicEvent).toHaveBeenCalledOnce();
    expect(deps.markConfirmed).toHaveBeenCalledWith(tagId, eventId);
  });

  it("returns the original half event for duplicate idempotency", async () => {
    const existing = hydrationEvent({
      eventType: "manual_intake",
      volumeMl: 325,
    });
    const deps = dependencies({
      duplicate: true,
      eventType: "manual_intake",
      preSnapshot: snapshot([existing]),
      volumeMl: 325,
    });
    const result = await completeNfcBottle({
      ...deps,
      input: validInput({ action: "half" }),
      now,
    });

    expect(result.duplicate).toBe(true);
    expect(result.action).toBe("half");
    expect(result.event.id).toBe(eventId);
    expect(deps.executeAtomicEvent).toHaveBeenCalledOnce();
    expect(deps.markConfirmed).not.toHaveBeenCalled();
  });

  it("keeps a half confirmation reversible through immutable history", () => {
    const half = hydrationEvent({
      eventType: "manual_intake",
      volumeMl: 325,
    });
    const reversal = hydrationEvent({
      eventType: "event_reversed",
      id: "half-reversal",
      idempotencyKey: "half-reversal-key",
      occurredAt: "2026-07-28T16:01:00.000Z",
      reversesEventId: half.id,
      volumeMl: null,
    });

    const projected = buildTodayDashboard(snapshot([half, reversal]), now);

    expect(projected.daySummary.consumedMl).toBe(0);
    expect(projected.daySummary.completedBottleCount).toBe(0);
    expect(snapshot([half, reversal]).events).toHaveLength(2);
  });

  it("rejects an idempotency key already used by another action", async () => {
    const existing = hydrationEvent({
      eventType: "manual_intake",
      source: "web",
    });
    const deps = dependencies({
      duplicate: true,
      preSnapshot: snapshot([existing]),
    });

    await expect(
      completeNfcBottle({
        ...deps,
        input: validInput(),
        now,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_EVENT" });
    expect(deps.executeAtomicEvent).not.toHaveBeenCalled();
    expect(deps.markConfirmed).not.toHaveBeenCalled();
  });

  it("rejects a conflicting event returned by a concurrent duplicate request", async () => {
    const deps = dependencies({
      duplicate: true,
      eventType: "manual_intake",
      volumeMl: 325,
    });

    await expect(
      completeNfcBottle({
        ...deps,
        input: validInput(),
        now,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_EVENT" });
    expect(deps.markConfirmed).not.toHaveBeenCalled();
  });

  it("warns when the same bottle was completed within 60 seconds", async () => {
    const recent = hydrationEvent({
      id: "recent-event",
      idempotencyKey: "different-key",
      occurredAt: "2026-07-28T15:59:30.000Z",
    });
    const deps = dependencies({ preSnapshot: snapshot([recent]) });

    await expect(
      completeNfcBottle({
        ...deps,
        input: validInput(),
        now,
      }),
    ).rejects.toMatchObject({ code: "RECENT_COMPLETION" });
    expect(deps.executeAtomicEvent).not.toHaveBeenCalled();
    expect(deps.markConfirmed).not.toHaveBeenCalled();
  });

  it("does not apply the rapid full-bottle warning to a deliberate half intake", async () => {
    const recent = hydrationEvent({
      id: "recent-event",
      idempotencyKey: "different-key",
      occurredAt: "2026-07-28T15:59:30.000Z",
    });
    const deps = dependencies({
      eventType: "manual_intake",
      preSnapshot: snapshot([recent]),
      volumeMl: 325,
    });

    const result = await completeNfcBottle({
      ...deps,
      input: validInput({ action: "half" }),
      now,
    });

    expect(result.action).toBe("half");
    expect(deps.executeAtomicEvent).toHaveBeenCalledOnce();
  });

  it("allows an explicit rapid-completion confirmation", async () => {
    const recent = hydrationEvent({
      id: "recent-event",
      idempotencyKey: "different-key",
      occurredAt: "2026-07-28T15:59:30.000Z",
    });
    const deps = dependencies({ preSnapshot: snapshot([recent]) });
    const result = await completeNfcBottle({
      ...deps,
      input: validInput({ confirmRecent: true }),
      now,
    });

    expect(result.event.eventType).toBe("bottle_completed");
    expect(deps.executeAtomicEvent).toHaveBeenCalledOnce();
  });

  it("does not warn after 60 seconds or for a reversed completion", () => {
    const old = hydrationEvent({
      id: "old-event",
      idempotencyKey: "old-key",
      occurredAt: "2026-07-28T15:59:00.000Z",
    });
    const reversed = hydrationEvent({
      id: "reversed-event",
      idempotencyKey: "reversed-key",
      occurredAt: "2026-07-28T15:59:30.000Z",
    });
    const reversal = hydrationEvent({
      eventType: "event_reversed",
      id: "reversal",
      idempotencyKey: "reversal-key",
      occurredAt: "2026-07-28T15:59:40.000Z",
      reversesEventId: reversed.id,
      volumeMl: null,
    });

    expect(
      hasRecentEffectiveCompletion({
        bottleId,
        idempotencyKey,
        occurredAt: now.toISOString(),
        snapshot: snapshot([old, reversed, reversal]),
      }),
    ).toBe(false);
  });

  it("updates last confirmed use only after successful processing", async () => {
    const deps = dependencies();
    const result = await completeNfcBottle({
      ...deps,
      input: validInput(),
      now,
    });

    expect(deps.markConfirmed).toHaveBeenCalledWith(tagId, eventId);
    expect(result.lastConfirmedAt).toBe("2026-07-28T16:00:01.000Z");
  });

  it("does not update last confirmed use after failed processing", async () => {
    const deps = dependencies();
    deps.executeAtomicEvent.mockResolvedValue({
      data: null,
      error: { code: "XX000" },
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      completeNfcBottle({
        ...deps,
        input: validInput(),
        now,
      }),
    ).rejects.toBeInstanceOf(HydrationApplicationError);
    expect(deps.markConfirmed).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("uses a generic unavailable error for unresolved tokens", async () => {
    const deps = dependencies({ resolved: null });

    await expect(
      completeNfcBottle({
        ...deps,
        input: validInput(),
        now,
      }),
    ).rejects.toMatchObject({ code: "NFC_TAG_UNAVAILABLE" });
    expect(deps.getHydrationSnapshot).not.toHaveBeenCalled();
  });
});

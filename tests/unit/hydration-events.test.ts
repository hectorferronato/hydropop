import { describe, expect, it } from "vitest";

import { reconstructBottleCycle } from "@/lib/domain/hydration/bottle-cycle";
import { getCreditedVolume } from "@/lib/domain/hydration/credited-volume";
import { summarizeHydrationDay } from "@/lib/domain/hydration/daily-summary";
import { reconstructEffectiveEvents } from "@/lib/domain/hydration/effective-events";
import type {
  HydrationEvent,
  HydrationEventType,
} from "@/lib/domain/hydration/event-types";

let eventSequence = 0;

function event(
  eventType: HydrationEventType,
  overrides: Partial<HydrationEvent> = {},
): HydrationEvent {
  eventSequence += 1;
  const occurredAt =
    overrides.occurredAt ??
    new Date(Date.UTC(2026, 6, 28, 12, eventSequence)).toISOString();

  return {
    bottleId: "bottle-1",
    createdAt: occurredAt,
    deviceId: null,
    eventType,
    id: `event-${eventSequence}`,
    idempotencyKey: `key-${eventSequence}`,
    metadata: {},
    occurredAt,
    receivedAt: occurredAt,
    reversesEventId: null,
    source: "web",
    userId: "user-1",
    volumeMl:
      eventType === "fill_started"
        ? 0
        : eventType === "event_reversed"
          ? null
          : 710,
    ...overrides,
  };
}

describe("hydration event projection", () => {
  it("credits bottle_completed from its immutable typical-fill snapshot without requiring a cycle", () => {
    const completion = event("bottle_completed", {
      metadata: {
        bottle_capacity_ml: 1_360,
        effective_credited_ml: 1_183,
        typical_fill_ml: 1_183,
      },
      volumeMl: 1_183,
    });
    const history = reconstructEffectiveEvents([completion]);
    const summary = summarizeHydrationDay({
      date: "2026-07-28",
      goalMl: 3_000,
      timeline: history.timeline,
      timezone: "UTC",
    });

    expect(getCreditedVolume(completion)).toBe(1_183);
    expect(summary.consumedMl).toBe(1_183);
    expect(summary.completedBottleCount).toBe(1);
    expect(reconstructBottleCycle(history.effectiveEvents)).toMatchObject({
      active: false,
      completedBottleCount: 0,
    });
  });

  it("credits bottle_completed from its immutable capacity fallback snapshot", () => {
    const completion = event("bottle_completed", {
      metadata: {
        bottle_capacity_ml: 1_360,
        effective_credited_ml: 1_360,
        typical_fill_ml: null,
      },
      volumeMl: 1_360,
    });

    expect(getCreditedVolume(completion)).toBe(1_360);
  });

  it("accumulates independent bottle completions", () => {
    const history = reconstructEffectiveEvents([
      event("bottle_completed", { volumeMl: 650 }),
      event("bottle_completed", { volumeMl: 650 }),
    ]);
    const summary = summarizeHydrationDay({
      date: "2026-07-28",
      goalMl: 2_000,
      timeline: history.timeline,
      timezone: "UTC",
    });

    expect(summary.consumedMl).toBe(1_300);
    expect(summary.completedBottleCount).toBe(2);
  });

  it("removes a reversed bottle completion from intake and bottle count", () => {
    const completion = event("bottle_completed", { volumeMl: 650 });
    const reversal = event("event_reversed", {
      reversesEventId: completion.id,
    });
    const history = reconstructEffectiveEvents([completion, reversal]);
    const summary = summarizeHydrationDay({
      date: "2026-07-28",
      goalMl: 2_000,
      timeline: history.timeline,
      timezone: "UTC",
    });

    expect(summary.consumedMl).toBe(0);
    expect(summary.completedBottleCount).toBe(0);
    expect(history.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          creditedVolumeMl: 0,
          id: completion.id,
          isEffective: false,
        }),
      ]),
    );
  });

  it("keeps completion totals stable after capacity and typical-fill edits", () => {
    const completion = event("bottle_completed", {
      metadata: {
        bottle_capacity_ml: 1_360,
        effective_credited_ml: 1_183,
        typical_fill_ml: 1_183,
      },
      volumeMl: 1_183,
    });
    const laterBottle = { capacityMl: 1_500, typicalFillMl: 1_250 };

    expect(laterBottle).toEqual({
      capacityMl: 1_500,
      typicalFillMl: 1_250,
    });
    expect(
      reconstructEffectiveEvents([completion]).effectiveEvents[0]
        ?.creditedVolumeMl,
    ).toBe(1_183);
  });

  it("credits a first fill as zero and opens a bottle cycle", () => {
    const firstFill = event("fill_started");
    const history = reconstructEffectiveEvents([firstFill]);

    expect(getCreditedVolume(firstFill)).toBe(0);
    expect(reconstructBottleCycle(history.effectiveEvents)).toMatchObject({
      active: true,
      completedBottleCount: 0,
    });
  });

  it("credits a refill with capacity at event time and starts the next cycle", () => {
    const history = reconstructEffectiveEvents([
      event("fill_started"),
      event("refill", {
        metadata: { bottle_capacity_ml: 710 },
        volumeMl: 710,
      }),
    ]);

    expect(history.effectiveEvents[1]?.creditedVolumeMl).toBe(710);
    expect(reconstructBottleCycle(history.effectiveEvents)).toMatchObject({
      active: true,
      completedBottleCount: 1,
    });
  });

  it("counts multiple refills as completed bottles while keeping a cycle active", () => {
    const history = reconstructEffectiveEvents([
      event("fill_started"),
      event("refill"),
      event("refill"),
    ]);

    expect(reconstructBottleCycle(history.effectiveEvents)).toMatchObject({
      active: true,
      completedBottleCount: 2,
    });
  });

  it("finishes a bottle without starting a replacement cycle", () => {
    const history = reconstructEffectiveEvents([
      event("fill_started"),
      event("bottle_finished"),
    ]);

    expect(reconstructBottleCycle(history.effectiveEvents)).toMatchObject({
      active: false,
      completedBottleCount: 1,
      startedAt: null,
    });
  });

  it("credits manual intake exactly without changing cycle state", () => {
    const manual = event("manual_intake", { volumeMl: 325 });
    const history = reconstructEffectiveEvents([event("fill_started"), manual]);

    expect(getCreditedVolume(manual)).toBe(325);
    expect(reconstructBottleCycle(history.effectiveEvents).active).toBe(true);
  });

  it("applies positive and negative adjustments", () => {
    expect(getCreditedVolume(event("adjustment", { volumeMl: 125 }))).toBe(125);
    expect(getCreditedVolume(event("adjustment", { volumeMl: -80 }))).toBe(-80);
  });

  it("never presents a negative effective daily total", () => {
    const history = reconstructEffectiveEvents([
      event("adjustment", { volumeMl: -500 }),
    ]);
    const summary = summarizeHydrationDay({
      date: "2026-07-28",
      goalMl: 2_000,
      timeline: history.timeline,
      timezone: "UTC",
    });

    expect(summary.rawConsumedMl).toBe(-500);
    expect(summary.consumedMl).toBe(0);
    expect(summary.goalPercentage).toBe(0);
  });

  it("retains reversal audit rows while removing original credit and state", () => {
    const firstFill = event("fill_started");
    const refill = event("refill");
    const reversal = event("event_reversed", {
      bottleId: refill.bottleId,
      reversesEventId: refill.id,
    });
    const history = reconstructEffectiveEvents([firstFill, refill, reversal]);

    expect(history.reversedEventIds.has(refill.id)).toBe(true);
    expect(
      history.timeline.find((item) => item.id === refill.id),
    ).toMatchObject({ creditedVolumeMl: 0, isEffective: false });
    expect(
      history.timeline.find((item) => item.id === reversal.id),
    ).toMatchObject({ creditedVolumeMl: 0, isEffective: false });
    expect(
      history.effectiveEvents.reduce(
        (total, item) => total + item.creditedVolumeMl,
        0,
      ),
    ).toBe(0);
    expect(reconstructBottleCycle(history.effectiveEvents)).toMatchObject({
      active: true,
      completedBottleCount: 0,
    });
  });

  it("reconstructs later cycle transitions after a cycle event is reversed", () => {
    const fill = event("fill_started");
    const refill = event("refill");
    const finish = event("bottle_finished");
    const reversal = event("event_reversed", {
      reversesEventId: refill.id,
    });
    const history = reconstructEffectiveEvents([
      fill,
      refill,
      finish,
      reversal,
    ]);

    expect(reconstructBottleCycle(history.effectiveEvents)).toMatchObject({
      active: false,
      completedBottleCount: 1,
    });
  });

  it("preserves historical bottle capacity from the event volume", () => {
    const oldRefill = event("refill", {
      metadata: { bottle_capacity_ml: 710 },
      volumeMl: 710,
    });
    const laterEditedBottleCapacityMl = 1_000;
    const history = reconstructEffectiveEvents([oldRefill]);

    expect(laterEditedBottleCapacityMl).toBe(1_000);
    expect(getCreditedVolume(oldRefill)).toBe(710);
    expect(history.effectiveEvents[0]?.creditedVolumeMl).toBe(710);
  });

  it("projects mixed legacy and bottle_completed history", () => {
    const history = reconstructEffectiveEvents([
      event("fill_started"),
      event("refill", { volumeMl: 710 }),
      event("bottle_finished", { volumeMl: 710 }),
      event("bottle_completed", { volumeMl: 650 }),
    ]);
    const summary = summarizeHydrationDay({
      date: "2026-07-28",
      goalMl: 3_000,
      timeline: history.timeline,
      timezone: "UTC",
    });

    expect(summary.consumedMl).toBe(2_070);
    expect(summary.completedBottleCount).toBe(3);
  });

  it("reconstructs fill_started → refill → reverse fill_started", () => {
    const fill = event("fill_started");
    const refill = event("refill", { volumeMl: 710 });
    const reversal = event("event_reversed", {
      reversesEventId: fill.id,
    });
    const history = reconstructEffectiveEvents([fill, refill, reversal]);
    const cycle = reconstructBottleCycle(history.effectiveEvents);

    expect(cycle).toEqual({
      active: true,
      bottleId: refill.bottleId,
      completedBottleCount: 1,
      startedAt: refill.occurredAt,
    });
    expect(
      history.effectiveEvents.reduce(
        (total, item) => total + item.creditedVolumeMl,
        0,
      ),
    ).toBe(710);
  });

  it("reconstructs fill_started → refill → refill → reverse middle refill", () => {
    const fill = event("fill_started");
    const middleRefill = event("refill", { volumeMl: 710 });
    const lastRefill = event("refill", { volumeMl: 710 });
    const reversal = event("event_reversed", {
      reversesEventId: middleRefill.id,
    });
    const history = reconstructEffectiveEvents([
      fill,
      middleRefill,
      lastRefill,
      reversal,
    ]);
    const cycle = reconstructBottleCycle(history.effectiveEvents);

    expect(cycle).toEqual({
      active: true,
      bottleId: lastRefill.bottleId,
      completedBottleCount: 1,
      startedAt: lastRefill.occurredAt,
    });
    expect(
      history.effectiveEvents.reduce(
        (total, item) => total + item.creditedVolumeMl,
        0,
      ),
    ).toBe(710);
  });

  it("reconstructs fill_started → refill → bottle_finished → reverse finish", () => {
    const fill = event("fill_started");
    const refill = event("refill", { volumeMl: 710 });
    const finish = event("bottle_finished", { volumeMl: 710 });
    const reversal = event("event_reversed", {
      reversesEventId: finish.id,
    });
    const history = reconstructEffectiveEvents([
      fill,
      refill,
      finish,
      reversal,
    ]);
    const cycle = reconstructBottleCycle(history.effectiveEvents);

    expect(cycle).toEqual({
      active: true,
      bottleId: refill.bottleId,
      completedBottleCount: 1,
      startedAt: refill.occurredAt,
    });
    expect(
      history.effectiveEvents.reduce(
        (total, item) => total + item.creditedVolumeMl,
        0,
      ),
    ).toBe(710);
  });

  it("removes a reversed adjustment exactly once", () => {
    const adjustment = event("adjustment", { volumeMl: 300 });
    const reversal = event("event_reversed", {
      reversesEventId: adjustment.id,
    });
    const history = reconstructEffectiveEvents([adjustment, reversal]);

    expect(getCreditedVolume(reversal, adjustment)).toBe(-300);
    expect(history.effectiveEvents).toHaveLength(0);
    expect(history.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          creditedVolumeMl: 0,
          id: adjustment.id,
          isEffective: false,
        }),
        expect.objectContaining({
          creditedVolumeMl: 0,
          id: reversal.id,
          isEffective: false,
        }),
      ]),
    );
    expect(reconstructBottleCycle(history.effectiveEvents).active).toBe(false);
  });

  it("removes reversed manual intake exactly once", () => {
    const manual = event("manual_intake", { volumeMl: 325 });
    const reversal = event("event_reversed", {
      reversesEventId: manual.id,
    });
    const history = reconstructEffectiveEvents([manual, reversal]);

    expect(history.effectiveEvents).toHaveLength(0);
    expect(
      history.timeline.reduce(
        (total, item) => total + item.creditedVolumeMl,
        0,
      ),
    ).toBe(0);
    expect(reconstructBottleCycle(history.effectiveEvents).active).toBe(false);
  });
});

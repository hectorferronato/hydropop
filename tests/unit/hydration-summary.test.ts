import { describe, expect, it } from "vitest";

import {
  buildCalendarSummary,
  buildTodayDashboard,
} from "@/lib/application/hydration/hydration-projection";
import { reconstructEffectiveEvents } from "@/lib/domain/hydration/effective-events";
import type { HydrationEvent } from "@/lib/domain/hydration/event-types";
import { calculateCurrentStreak } from "@/lib/domain/hydration/streaks";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

function hydrationEvent(
  id: string,
  eventType: HydrationEvent["eventType"],
  occurredAt: string,
  volumeMl: number,
): HydrationEvent {
  return {
    bottleId: "bottle-1",
    createdAt: occurredAt,
    deviceId: null,
    eventType,
    id,
    idempotencyKey: `key-${id}`,
    metadata: { bottle_capacity_ml: 710 },
    occurredAt,
    receivedAt: occurredAt,
    reversesEventId: null,
    source: "web",
    userId: "user-1",
    volumeMl,
  };
}

function snapshot(events: HydrationEvent[]): HydrationSnapshot {
  const bottle = {
    archived_at: null,
    capacity_ml: 710,
    id: "bottle-1",
    is_primary: true,
    name: "Daily bottle",
    typical_fill_ml: 650,
  } as const;

  return {
    bottles: [bottle],
    events,
    goals: [
      {
        created_at: "2026-07-01T00:00:00.000Z",
        daily_goal_ml: 1_420,
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

describe("hydration summaries", () => {
  it("calculates daily total and completed-bottle count", () => {
    const dashboard = buildTodayDashboard(
      snapshot([
        hydrationEvent("fill", "fill_started", "2026-07-28T12:00:00.000Z", 0),
        hydrationEvent("refill", "refill", "2026-07-28T15:00:00.000Z", 710),
        hydrationEvent(
          "finish",
          "bottle_finished",
          "2026-07-28T20:00:00.000Z",
          710,
        ),
      ]),
      new Date("2026-07-28T21:00:00.000Z"),
    );

    expect(dashboard.daySummary.consumedMl).toBe(1_420);
    expect(dashboard.daySummary.completedBottleCount).toBe(2);
    expect(dashboard.daySummary.goalPercentage).toBe(100);
  });

  it("counts new bottle completions in today and calendar projections", () => {
    const completion = hydrationEvent(
      "completion",
      "bottle_completed",
      "2026-07-28T15:00:00.000Z",
      650,
    );
    const dashboard = buildTodayDashboard(
      snapshot([completion]),
      new Date("2026-07-28T16:00:00.000Z"),
    );
    const calendar = buildCalendarSummary(snapshot([completion]), "2026-07");
    const day = calendar.days.find((item) => item.date === "2026-07-28");

    expect(dashboard.daySummary.completedBottleCount).toBe(1);
    expect(dashboard.lastBottleCompleted).toEqual({
      amountMl: 650,
      bottleName: "Daily bottle",
      occurredAt: "2026-07-28T15:00:00.000Z",
    });
    expect(day?.consumedMl).toBe(650);
    expect(day?.completedBottleCount).toBe(1);
  });

  it("records the first event that reaches the goal", () => {
    const dashboard = buildTodayDashboard(
      snapshot([
        hydrationEvent(
          "manual-1",
          "manual_intake",
          "2026-07-28T13:00:00.000Z",
          900,
        ),
        hydrationEvent(
          "manual-2",
          "manual_intake",
          "2026-07-28T16:30:00.000Z",
          520,
        ),
      ]),
      new Date("2026-07-28T17:00:00.000Z"),
    );

    expect(dashboard.daySummary.goalReachedAt).toBe("2026-07-28T16:30:00.000Z");
  });

  it("assigns an event to the authenticated user's local date", () => {
    const calendar = buildCalendarSummary(
      snapshot([
        hydrationEvent(
          "late",
          "manual_intake",
          "2026-07-28T01:30:00.000Z",
          500,
        ),
      ]),
      "2026-07",
    );

    expect(
      calendar.days.find((day) => day.date === "2026-07-27")?.consumedMl,
    ).toBe(500);
    expect(
      calendar.days.find((day) => day.date === "2026-07-28")?.consumedMl,
    ).toBe(0);
  });

  it("creates one deterministic calendar summary per day", () => {
    const calendar = buildCalendarSummary(snapshot([]), "2026-02");

    expect(calendar.days).toHaveLength(28);
    expect(calendar.days[0]?.date).toBe("2026-02-01");
    expect(calendar.days.at(-1)?.date).toBe("2026-02-28");
  });

  it("returns the latest effective event across the complete history", () => {
    const dashboard = buildTodayDashboard(
      snapshot([
        hydrationEvent(
          "previous-day",
          "manual_intake",
          "2026-07-27T18:00:00.000Z",
          300,
        ),
      ]),
      new Date("2026-07-28T16:00:00.000Z"),
    );

    expect(dashboard.latestEffectiveEvent?.id).toBe("previous-day");
    expect(dashboard.daySummary.timeline).toHaveLength(0);
  });

  it("calculates streaks ending today when today's goal is reached", () => {
    expect(
      calculateCurrentStreak(
        [
          { date: "2026-07-26", goalMl: 1_000, intakeMl: 1_100 },
          { date: "2026-07-27", goalMl: 1_000, intakeMl: 1_000 },
          { date: "2026-07-28", goalMl: 1_000, intakeMl: 1_200 },
        ],
        "2026-07-28",
      ),
    ).toBe(3);
  });

  it("keeps the prior streak while today's goal is still in progress", () => {
    expect(
      calculateCurrentStreak(
        [
          { date: "2026-07-26", goalMl: 1_000, intakeMl: 1_100 },
          { date: "2026-07-27", goalMl: 1_000, intakeMl: 1_000 },
          { date: "2026-07-28", goalMl: 1_000, intakeMl: 500 },
        ],
        "2026-07-28",
      ),
    ).toBe(2);
  });

  it("removes a reversed original from its historical hydration day", () => {
    const original = hydrationEvent(
      "original",
      "manual_intake",
      "2026-07-26T14:00:00.000Z",
      500,
    );
    const reversal: HydrationEvent = {
      ...hydrationEvent(
        "reversal",
        "event_reversed",
        "2026-07-28T14:00:00.000Z",
        0,
      ),
      reversesEventId: original.id,
      volumeMl: null,
    };
    const history = reconstructEffectiveEvents([original, reversal]);

    expect(history.effectiveEvents).toHaveLength(0);
  });
});

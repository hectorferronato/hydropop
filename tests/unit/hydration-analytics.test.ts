import { describe, expect, it } from "vitest";

import {
  buildPrivateProfileSummary,
  buildTrendsSummary,
  calculateCircularTimeMinutes,
  parseTrendRange,
  profileInitials,
} from "@/lib/application/analytics/hydration-analytics";
import type { HydrationEvent } from "@/lib/domain/hydration/event-types";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { formatDisplayVolume } from "@/lib/units/volume";

const bottleId = "bottle-1";
const userId = "user-1";

function event({
  eventType = "manual_intake",
  id,
  occurredAt,
  reversesEventId = null,
  source = "web",
  volumeMl,
}: {
  eventType?: HydrationEvent["eventType"];
  id: string;
  occurredAt: string;
  reversesEventId?: string | null;
  source?: HydrationEvent["source"];
  volumeMl: number | null;
}): HydrationEvent {
  return {
    bottleId,
    createdAt: occurredAt,
    deviceId: null,
    eventType,
    id,
    idempotencyKey: `key-${id}`,
    metadata: { effective_credited_ml: volumeMl },
    occurredAt,
    receivedAt: occurredAt,
    reversesEventId,
    source,
    userId,
    volumeMl,
  };
}

function analyticsSnapshot(
  overrides: Partial<HydrationSnapshot> = {},
): HydrationSnapshot {
  const reversed = event({
    id: "reversed-manual",
    occurredAt: "2026-07-03T09:00:00.000Z",
    volumeMl: 500,
  });

  return {
    bottles: [],
    events: [
      event({
        id: "day-1",
        occurredAt: "2026-07-01T09:00:00.000Z",
        volumeMl: 1_000,
      }),
      event({
        eventType: "bottle_completed",
        id: "full-1",
        occurredAt: "2026-07-02T10:00:00.000Z",
        volumeMl: 600,
      }),
      event({
        id: "half",
        occurredAt: "2026-07-02T12:00:00.000Z",
        source: "nfc",
        volumeMl: 300,
      }),
      event({
        eventType: "adjustment",
        id: "adjustment",
        occurredAt: "2026-07-02T13:00:00.000Z",
        volumeMl: 100,
      }),
      reversed,
      event({
        eventType: "bottle_completed",
        id: "full-2",
        occurredAt: "2026-07-04T14:30:00.000Z",
        volumeMl: 1_500,
      }),
      event({
        eventType: "event_reversed",
        id: "reversal",
        occurredAt: "2026-07-05T08:00:00.000Z",
        reversesEventId: reversed.id,
        volumeMl: null,
      }),
      event({
        eventType: "bottle_completed",
        id: "full-3",
        occurredAt: "2026-07-06T23:50:00.000Z",
        volumeMl: 1_600,
      }),
    ],
    goals: [
      {
        created_at: "2026-07-01T00:00:00.000Z",
        daily_goal_ml: 1_000,
        effective_from: "2026-07-01",
        effective_until: "2026-07-03",
        id: "goal-1",
        target_completion_time: "20:00:00",
      },
      {
        created_at: "2026-07-04T00:00:00.000Z",
        daily_goal_ml: 1_500,
        effective_from: "2026-07-04",
        effective_until: null,
        id: "goal-2",
        target_completion_time: "20:00:00",
      },
    ],
    primaryBottle: null,
    profile: {
      created_at: "2026-06-20T15:00:00.000Z",
      display_name: "Beatriz Teixeira",
      preferred_unit: "oz",
      target_completion_time: "20:00:00",
      timezone: "UTC",
      wake_time: "07:00:00",
    },
    ...overrides,
  };
}

const now = new Date("2026-07-06T23:59:00.000Z");

describe("hydration analytics", () => {
  it("validates supported trend ranges and defaults invalid input to 30", () => {
    expect(parseTrendRange("7")).toBe(7);
    expect(parseTrendRange("30")).toBe(30);
    expect(parseTrendRange("90")).toBe(90);
    expect(parseTrendRange("3")).toBe(30);
    expect(parseTrendRange("not-a-range")).toBe(30);
    expect(parseTrendRange(null)).toBe(30);
  });

  it("calculates daily totals, historical goals, and reversal-safe history", () => {
    const trends = buildTrendsSummary(analyticsSnapshot(), 30, now);

    expect(trends.days.map((day) => day.intakeMl)).toEqual([
      1_000, 1_000, 0, 1_500, 0, 1_600,
    ]);
    expect(trends.days.map((day) => day.goalMl)).toEqual([
      1_000, 1_000, 1_000, 1_500, 1_500, 1_500,
    ]);
    expect(trends.startDate).toBe("2026-07-01");
  });

  it("reports absolute, percentage, and zero-previous-day changes safely", () => {
    const trends = buildTrendsSummary(analyticsSnapshot(), 30, now);

    expect(trends.days[1]?.change).toEqual({
      absoluteMl: 0,
      percentage: 0,
    });
    expect(trends.days[2]?.change).toEqual({
      absoluteMl: -1_000,
      percentage: -100,
    });
    expect(trends.days[3]?.change).toEqual({
      absoluteMl: 1_500,
      percentage: null,
    });
  });

  it("calculates goal rate plus current and best streaks", () => {
    const trends = buildTrendsSummary(analyticsSnapshot(), 30, now);

    expect(trends.goalRate).toEqual({
      eligibleDays: 6,
      metDays: 4,
      percentage: 67,
    });
    expect(trends.currentGoalStreak).toBe(1);
    expect(trends.bestGoalStreak).toBe(2);
  });

  it("preserves yesterday's streak while today's local day is incomplete", () => {
    const snapshot = analyticsSnapshot({
      events: [
        event({
          id: "prior-1",
          occurredAt: "2026-07-04T12:00:00.000Z",
          volumeMl: 1_500,
        }),
        event({
          id: "prior-2",
          occurredAt: "2026-07-05T12:00:00.000Z",
          volumeMl: 1_500,
        }),
        event({
          id: "today-partial",
          occurredAt: "2026-07-06T12:00:00.000Z",
          volumeMl: 500,
        }),
      ],
    });

    expect(buildTrendsSummary(snapshot, 30, now).currentGoalStreak).toBe(2);
  });

  it("uses only full bottle completions for timing insights", () => {
    const timing = buildTrendsSummary(
      analyticsSnapshot(),
      30,
      now,
    ).completionTiming;

    expect(timing.sampleCount).toBe(3);
    expect(timing.blocks).toEqual({
      afternoon: 1,
      evening: 0,
      morning: 1,
      night: 1,
    });
  });

  it("uses a circular clock average for completions around midnight", () => {
    const typical = calculateCircularTimeMinutes([23 * 60 + 50, 10, 20]);

    expect(typical).not.toBeNull();
    expect(typical ?? 1_000).toBeLessThan(30);
    expect(calculateCircularTimeMinutes([10, 20])).toBeNull();
  });

  it("groups event times using the profile timezone", () => {
    const snapshot = analyticsSnapshot({
      events: [
        event({
          eventType: "bottle_completed",
          id: "timezone-completion",
          occurredAt: "2026-07-06T02:00:00.000Z",
          volumeMl: 1_500,
        }),
      ],
      profile: {
        ...analyticsSnapshot().profile!,
        timezone: "America/New_York",
      },
    });
    const timing = buildTrendsSummary(
      snapshot,
      30,
      new Date("2026-07-06T16:00:00.000Z"),
    ).completionTiming;

    expect(timing.blocks.night).toBe(1);
    expect(timing.blocks.morning).toBe(0);
  });

  it("builds a partial seven-day rolling average with zero-intake days", () => {
    const rolling = buildTrendsSummary(
      analyticsSnapshot(),
      30,
      now,
    ).rollingAverage.at(-1);

    expect(rolling).toEqual({
      averageIntakeMl: 850,
      date: "2026-07-06",
      daysUsed: 6,
      goalMl: 1_500,
      status: "below",
    });
  });

  it("distinguishes selected-range emptiness from having no history", () => {
    const snapshot = analyticsSnapshot({
      events: [
        event({
          id: "old-history",
          occurredAt: "2026-06-01T12:00:00.000Z",
          volumeMl: 500,
        }),
      ],
      goals: [],
    });
    const trends = buildTrendsSummary(snapshot, 7, now);

    expect(trends.hasHydrationHistory).toBe(true);
    expect(trends.hasHydrationEvents).toBe(false);
    expect(trends.startDate).toBe("2026-06-30");
  });

  it("builds private lifetime statistics without counting half intake as a bottle", () => {
    const profile = buildPrivateProfileSummary(analyticsSnapshot(), now);

    expect(profile.lifetimeHydrationMl).toBe(5_100);
    expect(profile.totalCompletedBottles).toBe(3);
    expect(profile.daysGoalMet).toBe(4);
    expect(profile.currentGoalStreak).toBe(1);
    expect(profile.bestGoalStreak).toBe(2);
    expect(profile.activeDayCount).toBe(6);
    expect(profile.averageDailyIntakeMl).toBe(850);
    expect(profile.preferredUnit).toBe("oz");
    expect(formatDisplayVolume(profile.averageDailyIntakeMl ?? 0, "oz")).toBe(
      "28.7",
    );
  });

  it("handles empty profile history without invalid averages", () => {
    const profile = buildPrivateProfileSummary(
      analyticsSnapshot({ events: [], goals: [] }),
      now,
    );

    expect(profile.lifetimeHydrationMl).toBe(0);
    expect(profile.totalCompletedBottles).toBe(0);
    expect(profile.averageDailyIntakeMl).toBeNull();
    expect(profile.activeDayCount).toBe(0);
  });

  it("creates tasteful initials without an image dependency", () => {
    expect(profileInitials("Beatriz Teixeira")).toBe("BT");
    expect(profileInitials("Beatriz")).toBe("B");
    expect(profileInitials(null)).toBe("HP");
  });

  it("excludes future events and dates from trends and profile statistics", () => {
    const current = event({
      id: "current",
      occurredAt: "2026-07-06T12:00:00.000Z",
      volumeMl: 500,
    });
    const snapshot = analyticsSnapshot({
      events: [
        current,
        event({
          eventType: "bottle_completed",
          id: "future",
          occurredAt: "2026-07-06T23:59:30.000Z",
          volumeMl: 1_500,
        }),
        event({
          eventType: "event_reversed",
          id: "future-reversal",
          occurredAt: "2026-07-06T23:59:45.000Z",
          reversesEventId: current.id,
          volumeMl: null,
        }),
      ],
    });
    const trends = buildTrendsSummary(snapshot, 7, now);
    const profile = buildPrivateProfileSummary(snapshot, now);

    expect(trends.days.at(-1)?.date).toBe("2026-07-06");
    expect(trends.days.at(-1)?.intakeMl).toBe(500);
    expect(trends.completionTiming.sampleCount).toBe(0);
    expect(profile.lifetimeHydrationMl).toBe(500);
    expect(profile.totalCompletedBottles).toBe(0);
  });
});

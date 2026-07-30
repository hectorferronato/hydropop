import { describe, expect, it } from "vitest";

import {
  buildCalendarWeeks,
  getCurrentWeekIndex,
} from "@/lib/application/calendar/calendar-view";
import { buildCalendarSummary } from "@/lib/application/hydration/hydration-projection";
import type { HydrationEvent } from "@/lib/domain/hydration/event-types";
import { getDateInTimezone } from "@/lib/domain/hydration/hydration-day";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

function emptySnapshot(timezone: string): HydrationSnapshot {
  return {
    bottles: [],
    events: [],
    goals: [],
    primaryBottle: null,
    profile: {
      display_name: "Bea",
      preferred_unit: "oz",
      target_completion_time: null,
      timezone,
      wake_time: null,
    },
  };
}

describe("calendar view", () => {
  it("opens the profile-local current month", () => {
    const instant = new Date("2026-08-01T01:30:00.000Z");
    const currentDate = getDateInTimezone("America/New_York", instant);

    expect(currentDate).toBe("2026-07-31");
    expect(currentDate.slice(0, 7)).toBe("2026-07");
  });

  it("keeps dates chronological while grouping them into calendar weeks", () => {
    const summary = buildCalendarSummary(
      emptySnapshot("America/New_York"),
      "2026-07",
    );
    const weeks = buildCalendarWeeks("2026-07", summary.days);
    const dates = weeks.flat().flatMap((day) => (day ? [day.date] : []));

    expect(dates).toEqual(summary.days.map((day) => day.date));
    expect(weeks[0]?.slice(0, 3)).toEqual([null, null, null]);
  });

  it("identifies the week row containing today", () => {
    expect(getCurrentWeekIndex("2026-07", "2026-07-29")).toBe(4);
  });

  it("does not create a false current-week target in another month", () => {
    expect(getCurrentWeekIndex("2026-06", "2026-07-29")).toBeNull();
  });

  it("does not shift hydration into the UTC date around local midnight", () => {
    const occurredAt = "2026-08-01T01:30:00.000Z";
    const hydrationEvent: HydrationEvent = {
      bottleId: "bottle-1",
      createdAt: occurredAt,
      deviceId: null,
      eventType: "manual_intake",
      id: "event-1",
      idempotencyKey: "calendar-timezone-test",
      metadata: { effective_credited_ml: 500 },
      occurredAt,
      receivedAt: occurredAt,
      reversesEventId: null,
      source: "web",
      userId: "user-1",
      volumeMl: 500,
    };
    const snapshot = {
      ...emptySnapshot("America/New_York"),
      events: [hydrationEvent],
    };
    const july = buildCalendarSummary(snapshot, "2026-07");
    const august = buildCalendarSummary(snapshot, "2026-08");

    expect(july.days.at(-1)?.consumedMl).toBe(500);
    expect(august.days[0]?.consumedMl).toBe(0);
  });
});

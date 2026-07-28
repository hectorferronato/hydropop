import { getDateInTimezone } from "./hydration-day";
import {
  compareHydrationEvents,
  type HydrationTimelineEvent,
} from "./event-types";

export type HydrationDaySummary = {
  completedBottleCount: number;
  consumedMl: number;
  date: string;
  firstEffectiveEvent: HydrationTimelineEvent | null;
  goalMl: number | null;
  goalPercentage: number | null;
  goalReached: boolean;
  goalReachedAt: string | null;
  lastEffectiveEvent: HydrationTimelineEvent | null;
  rawConsumedMl: number;
  timeline: HydrationTimelineEvent[];
};

function clampPercentage(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function summarizeHydrationDay({
  date,
  goalMl,
  timezone,
  timeline,
}: {
  date: string;
  goalMl: number | null;
  timezone: string;
  timeline: readonly HydrationTimelineEvent[];
}): HydrationDaySummary {
  const dayTimeline = timeline
    .filter(
      (event) =>
        getDateInTimezone(timezone, new Date(event.occurredAt)) === date,
    )
    .sort(compareHydrationEvents);
  const effectiveEvents = dayTimeline.filter((event) => event.isEffective);
  const rawConsumedMl = effectiveEvents.reduce(
    (total, event) => total + event.creditedVolumeMl,
    0,
  );
  const consumedMl = Math.max(0, rawConsumedMl);
  const completedBottleCount = effectiveEvents.filter(
    (event) =>
      event.eventType === "bottle_completed" ||
      event.eventType === "refill" ||
      event.eventType === "bottle_finished",
  ).length;
  const goalReached = goalMl !== null && consumedMl >= goalMl;
  let runningTotal = 0;
  let goalReachedAt: string | null = null;

  if (goalReached && goalMl !== null) {
    for (const event of effectiveEvents) {
      runningTotal = Math.max(0, runningTotal + event.creditedVolumeMl);

      if (runningTotal >= goalMl) {
        goalReachedAt = event.occurredAt;
        break;
      }
    }
  }

  return {
    completedBottleCount,
    consumedMl,
    date,
    firstEffectiveEvent: effectiveEvents[0] ?? null,
    goalMl,
    goalPercentage:
      goalMl === null ? null : clampPercentage((consumedMl / goalMl) * 100),
    goalReached,
    goalReachedAt,
    lastEffectiveEvent: effectiveEvents.at(-1) ?? null,
    rawConsumedMl,
    timeline: dayTimeline,
  };
}

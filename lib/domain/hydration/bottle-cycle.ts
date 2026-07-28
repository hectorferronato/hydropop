import {
  compareHydrationEvents,
  type HydrationTimelineEvent,
} from "./event-types";

export type BottleCycleState = {
  active: boolean;
  bottleId: string | null;
  completedBottleCount: number;
  startedAt: string | null;
};

export function reconstructBottleCycle(
  effectiveEvents: readonly HydrationTimelineEvent[],
  bottleId?: string,
): BottleCycleState {
  const relevantEvents = effectiveEvents
    .filter((event) => !bottleId || event.bottleId === bottleId)
    .sort(compareHydrationEvents);
  let active = false;
  let activeBottleId: string | null = null;
  let startedAt: string | null = null;
  let completedBottleCount = 0;

  for (const event of relevantEvents) {
    switch (event.eventType) {
      case "fill_started":
        active = true;
        activeBottleId = event.bottleId;
        startedAt = event.occurredAt;
        break;
      case "refill":
        completedBottleCount += 1;
        active = true;
        activeBottleId = event.bottleId;
        startedAt = event.occurredAt;
        break;
      case "bottle_finished":
        completedBottleCount += 1;
        active = false;
        activeBottleId = null;
        startedAt = null;
        break;
      case "adjustment":
      case "bottle_completed":
      case "event_reversed":
      case "manual_intake":
        break;
    }
  }

  return {
    active,
    bottleId: activeBottleId,
    completedBottleCount,
    startedAt,
  };
}

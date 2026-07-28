import { getCreditedVolume } from "./credited-volume";
import {
  compareHydrationEvents,
  type HydrationEvent,
  type HydrationTimelineEvent,
} from "./event-types";

export type EffectiveHydrationHistory = {
  effectiveEvents: HydrationTimelineEvent[];
  reversedEventIds: ReadonlySet<string>;
  timeline: HydrationTimelineEvent[];
};

export function reconstructEffectiveEvents(
  events: readonly HydrationEvent[],
): EffectiveHydrationHistory {
  const ordered = [...events].sort(compareHydrationEvents);
  const reversedEventIds = new Set<string>();

  for (const event of ordered) {
    if (event.eventType === "event_reversed" && event.reversesEventId) {
      reversedEventIds.add(event.reversesEventId);
    }
  }

  const timeline = ordered.map<HydrationTimelineEvent>((event) => {
    if (event.eventType === "event_reversed") {
      return {
        ...event,
        // Effective history removes the original. The audit-only reversal must
        // therefore contribute zero here so the volume is applied exactly once.
        creditedVolumeMl: 0,
        isEffective: false,
      };
    }

    const isEffective = !reversedEventIds.has(event.id);

    return {
      ...event,
      creditedVolumeMl: isEffective ? getCreditedVolume(event) : 0,
      isEffective,
    };
  });

  return {
    effectiveEvents: timeline.filter((event) => event.isEffective),
    reversedEventIds,
    timeline,
  };
}

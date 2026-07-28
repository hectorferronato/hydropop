import type { HydrationEvent } from "./event-types";

export class InvalidHydrationEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHydrationEventError";
  }
}

function requirePositiveVolume(event: HydrationEvent): number {
  if (event.volumeMl === null || event.volumeMl <= 0) {
    throw new InvalidHydrationEventError(
      `${event.eventType} requires a positive volume.`,
    );
  }

  return event.volumeMl;
}

export function getCreditedVolume(
  event: HydrationEvent,
  referencedEvent?: HydrationEvent,
): number {
  switch (event.eventType) {
    case "fill_started":
      return 0;
    case "refill":
    case "bottle_finished":
    case "bottle_completed":
    case "manual_intake":
      return requirePositiveVolume(event);
    case "adjustment":
      if (event.volumeMl === null || event.volumeMl === 0) {
        throw new InvalidHydrationEventError(
          "adjustment requires a non-zero signed volume.",
        );
      }

      return event.volumeMl;
    case "event_reversed":
      if (!referencedEvent || referencedEvent.eventType === "event_reversed") {
        throw new InvalidHydrationEventError(
          "event_reversed requires a reversible event.",
        );
      }

      return -getCreditedVolume(referencedEvent);
  }
}

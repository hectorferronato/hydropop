export const hydrationEventTypes = [
  "fill_started",
  "refill",
  "bottle_finished",
  "bottle_completed",
  "manual_intake",
  "adjustment",
  "event_reversed",
] as const;

export type HydrationEventType = (typeof hydrationEventTypes)[number];

export const clientHydrationEventTypes = [
  "bottle_completed",
  "manual_intake",
  "adjustment",
  "event_reversed",
] as const satisfies readonly HydrationEventType[];

export type ClientHydrationEventType =
  (typeof clientHydrationEventTypes)[number];

export const hydrationSources = [
  "nfc",
  "web",
  "simulator",
  "mobile",
  "charm",
  "device",
  "admin",
] as const;

export type HydrationSource = (typeof hydrationSources)[number];

export const clientHydrationSources = [
  "nfc",
  "web",
  "simulator",
  "mobile",
  "charm",
  "admin",
] as const satisfies readonly HydrationSource[];

export type HydrationEvent = {
  bottleId: string;
  createdAt: string;
  deviceId: string | null;
  eventType: HydrationEventType;
  id: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  receivedAt: string;
  reversesEventId: string | null;
  source: HydrationSource;
  userId: string;
  volumeMl: number | null;
};

export type HydrationTimelineEvent = HydrationEvent & {
  creditedVolumeMl: number;
  isEffective: boolean;
};

export function compareHydrationEvents(
  left: HydrationEvent,
  right: HydrationEvent,
): number {
  return (
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
    Date.parse(left.receivedAt) - Date.parse(right.receivedAt) ||
    left.id.localeCompare(right.id)
  );
}

export function isCycleEvent(
  eventType: HydrationEventType,
): eventType is "bottle_finished" | "fill_started" | "refill" {
  return (
    eventType === "fill_started" ||
    eventType === "refill" ||
    eventType === "bottle_finished"
  );
}

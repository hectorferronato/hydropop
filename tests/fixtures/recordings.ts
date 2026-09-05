import type { HydrationEvent } from "@/lib/domain/hydration/event-types";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

export const eventId = "bfdb4a6d-f46c-43c0-8ae1-8047e12b2e95";
export const now = new Date("2026-09-05T20:00:00Z");
export const original: HydrationEvent = {
  id: eventId,
  bottleId: "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0",
  userId: "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c",
  eventType: "bottle_completed",
  source: "device",
  volumeMl: 887,
  createdAt: "2026-09-05T14:00:00Z",
  occurredAt: "2026-09-05T14:00:00Z",
  receivedAt: "2026-09-05T14:00:00Z",
  deviceId: null,
  reversesEventId: null,
  idempotencyKey: "fixture-original",
  metadata: {},
};
export function snapshot(
  events: HydrationEvent[] = [original],
): HydrationSnapshot {
  const bottle = {
    id: original.bottleId,
    archived_at: null,
    capacity_ml: 887,
    typical_fill_ml: 887,
    name: "Bottle",
    is_primary: true,
  };
  return {
    events,
    bottles: [bottle],
    primaryBottle: bottle,
    profile: {
      display_name: "Test",
      preferred_unit: "ml",
      timezone: "America/New_York",
      wake_time: "07:00:00",
      target_completion_time: "20:00:00",
    },
    goals: [
      {
        id: "goal",
        created_at: "2026-01-01T00:00:00Z",
        daily_goal_ml: 2000,
        effective_from: "2026-01-01",
        effective_until: null,
        target_completion_time: "20:00:00",
      },
    ],
  };
}
export function reverse(event: HydrationEvent): HydrationEvent {
  return {
    ...original,
    id: `${event.id}-reverse`,
    eventType: "event_reversed",
    volumeMl: null,
    occurredAt: now.toISOString(),
    reversesEventId: event.id,
  };
}

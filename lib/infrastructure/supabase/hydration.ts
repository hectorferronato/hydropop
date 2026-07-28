import type { SupabaseClient } from "@supabase/supabase-js";

import {
  hydrationEventTypes,
  hydrationSources,
  type HydrationEvent,
  type HydrationEventType,
  type HydrationSource,
} from "@/lib/domain/hydration/event-types";

import type { Database, Json } from "./database.types";

type EventRow = Database["public"]["Tables"]["hydration_events"]["Row"];

export type HydrationProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "display_name"
  | "preferred_unit"
  | "target_completion_time"
  | "timezone"
  | "wake_time"
>;

export type HydrationBottle = Pick<
  Database["public"]["Tables"]["bottles"]["Row"],
  | "archived_at"
  | "capacity_ml"
  | "id"
  | "is_primary"
  | "name"
  | "typical_fill_ml"
>;

export type HydrationGoal = Pick<
  Database["public"]["Tables"]["hydration_goals"]["Row"],
  | "created_at"
  | "daily_goal_ml"
  | "effective_from"
  | "effective_until"
  | "id"
  | "target_completion_time"
>;

export type HydrationSnapshot = {
  bottles: HydrationBottle[];
  events: HydrationEvent[];
  goals: HydrationGoal[];
  primaryBottle: HydrationBottle | null;
  profile: HydrationProfile | null;
};

type SupabaseQueryError = {
  code: string;
};

export class HydrationReadError extends Error {
  constructor(resource: "bottle" | "events" | "goals" | "profile") {
    super(`Unable to load hydration ${resource}.`);
    this.name = "HydrationReadError";
  }
}

function throwReadError(
  resource: "bottle" | "events" | "goals" | "profile",
  error: SupabaseQueryError,
): never {
  console.error(`[HydroPOP] Hydration ${resource} query failed.`, {
    code: error.code,
  });
  throw new HydrationReadError(resource);
}

function isEventType(value: string): value is HydrationEventType {
  return hydrationEventTypes.some((eventType) => eventType === value);
}

function isHydrationSource(value: string): value is HydrationSource {
  return hydrationSources.some((source) => source === value);
}

function toMetadata(value: Json): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function toHydrationEvent(row: EventRow): HydrationEvent {
  if (!isEventType(row.event_type) || !isHydrationSource(row.source)) {
    throw new HydrationReadError("events");
  }

  return {
    bottleId: row.bottle_id,
    createdAt: row.created_at,
    deviceId: row.device_id,
    eventType: row.event_type,
    id: row.id,
    idempotencyKey: row.idempotency_key,
    metadata: toMetadata(row.metadata),
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    reversesEventId: row.reverses_event_id,
    source: row.source,
    userId: row.user_id,
    volumeMl: row.volume_ml,
  };
}

export async function getHydrationSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<HydrationSnapshot> {
  const [profileResult, bottleResult, goalsResult, eventsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, preferred_unit, target_completion_time, timezone, wake_time",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("bottles")
        .select(
          "archived_at, capacity_ml, id, is_primary, name, typical_fill_ml",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true }),
      supabase
        .from("hydration_goals")
        .select(
          "created_at, daily_goal_ml, effective_from, effective_until, id, target_completion_time",
        )
        .eq("user_id", userId)
        .order("effective_from", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("hydration_events")
        .select("*")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: true })
        .order("received_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);

  if (profileResult.error) {
    throwReadError("profile", profileResult.error);
  }

  if (bottleResult.error) {
    throwReadError("bottle", bottleResult.error);
  }

  if (goalsResult.error) {
    throwReadError("goals", goalsResult.error);
  }

  if (eventsResult.error) {
    throwReadError("events", eventsResult.error);
  }

  return {
    bottles: bottleResult.data ?? [],
    events: (eventsResult.data ?? []).map(toHydrationEvent),
    goals: goalsResult.data ?? [],
    primaryBottle:
      bottleResult.data?.find(
        (bottle) => bottle.is_primary && bottle.archived_at === null,
      ) ?? null,
    profile: profileResult.data,
  };
}

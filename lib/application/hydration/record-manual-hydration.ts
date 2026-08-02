import {
  processHydrationEvent,
  type AtomicHydrationEventExecutor,
} from "@/lib/application/hydration/process-hydration-event";
import { HydrationApplicationError } from "@/lib/contracts/api-response";
import { toHydrationSuccessPayload } from "@/lib/contracts/hydration-success";
import {
  manualHydrationInputSchema,
  type ManualHydrationResult,
} from "@/lib/contracts/manual-hydration";
import type { TodayDashboard } from "@/lib/contracts/dashboard";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

export function calculateHalfManualVolumeMl(normalFillMl: number): number {
  return Math.max(1, Math.round(normalFillMl / 2));
}

export async function recordManualHydration({
  executeAtomicEvent,
  getHydrationSnapshot,
  getUpdatedDashboard,
  input,
  now = new Date(),
}: {
  executeAtomicEvent: AtomicHydrationEventExecutor;
  getHydrationSnapshot: () => Promise<HydrationSnapshot>;
  getUpdatedDashboard: () => Promise<TodayDashboard>;
  input: unknown;
  now?: Date;
}): Promise<ManualHydrationResult> {
  const parsed = manualHydrationInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new HydrationApplicationError("INVALID_INPUT");
  }

  const snapshot = await getHydrationSnapshot();
  const bottle = snapshot.primaryBottle;

  if (!bottle) {
    throw new HydrationApplicationError("NO_PRIMARY_BOTTLE");
  }

  const eventType =
    parsed.data.action === "full" ? "bottle_completed" : "manual_intake";
  const knownDuplicate = snapshot.events.find(
    (event) => event.idempotencyKey === parsed.data.idempotencyKey,
  );

  if (
    knownDuplicate &&
    (knownDuplicate.bottleId !== bottle.id ||
      knownDuplicate.eventType !== eventType ||
      knownDuplicate.source !== "web")
  ) {
    throw new HydrationApplicationError("DUPLICATE_EVENT");
  }

  const normalFillMl = bottle.typical_fill_ml ?? bottle.capacity_ml;
  const result = await processHydrationEvent({
    executeAtomicEvent,
    getUpdatedDashboard,
    input: {
      bottleId: bottle.id,
      eventType,
      idempotencyKey: parsed.data.idempotencyKey,
      occurredAt: parsed.data.occurredAt,
      source: "web",
      ...(parsed.data.action === "half"
        ? { volumeMl: calculateHalfManualVolumeMl(normalFillMl) }
        : {}),
    },
    now,
  });

  if (
    result.event.bottleId !== bottle.id ||
    result.event.eventType !== eventType ||
    result.event.source !== "web"
  ) {
    throw new HydrationApplicationError("DUPLICATE_EVENT");
  }

  return toHydrationSuccessPayload({
    ...result,
    action: parsed.data.action,
  });
}

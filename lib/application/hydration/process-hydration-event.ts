import { z } from "zod";

import {
  apiErrorCodes,
  HydrationApplicationError,
  type ApiErrorCode,
} from "@/lib/contracts/api-response";
import {
  hydrationEventInputSchema,
  type HydrationEventInput,
  type ProcessHydrationEventResult,
} from "@/lib/contracts/hydration-events";
import { validateEventWindow } from "@/lib/domain/hydration/event-window";
import { toHydrationEvent } from "@/lib/infrastructure/supabase/hydration";

import type { TodayDashboard } from "@/lib/contracts/dashboard";
import type { Database } from "@/lib/infrastructure/supabase/database.types";

type EventRow = Database["public"]["Tables"]["hydration_events"]["Row"];

const rpcResultSchema = z.discriminatedUnion("ok", [
  z.object({
    duplicate: z.boolean(),
    event: z.custom<EventRow>(
      (value) => value !== null && typeof value === "object",
    ),
    ok: z.literal(true),
  }),
  z.object({
    error_code: z.string(),
    ok: z.literal(false),
  }),
]);

export type ProcessHydrationEventArguments = {
  p_bottle_id: string;
  p_device_id?: string;
  p_event_type: string;
  p_idempotency_key: string;
  p_occurred_at: string;
  p_reverses_event_id?: string;
  p_source: string;
  p_volume_ml?: number;
};

export type AtomicHydrationEventExecutor = (
  arguments_: ProcessHydrationEventArguments,
) => Promise<{ data: unknown; error: { code: string } | null }>;

function isApiErrorCode(value: string): value is ApiErrorCode {
  return apiErrorCodes.some((code) => code === value);
}

export function toProcessHydrationEventArguments(
  input: HydrationEventInput,
): ProcessHydrationEventArguments {
  return {
    p_bottle_id: input.bottleId,
    ...(input.deviceId ? { p_device_id: input.deviceId } : {}),
    p_event_type: input.eventType,
    p_idempotency_key: input.idempotencyKey,
    p_occurred_at: input.occurredAt,
    ...(input.reversesEventId
      ? { p_reverses_event_id: input.reversesEventId }
      : {}),
    p_source: input.source,
    ...(input.volumeMl === null || input.volumeMl === undefined
      ? {}
      : { p_volume_ml: input.volumeMl }),
  };
}

export async function processHydrationEvent({
  executeAtomicEvent,
  getUpdatedDashboard,
  input,
  now = new Date(),
}: {
  executeAtomicEvent: AtomicHydrationEventExecutor;
  getUpdatedDashboard: () => Promise<TodayDashboard>;
  input: unknown;
  now?: Date;
}): Promise<ProcessHydrationEventResult> {
  const parsed = hydrationEventInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new HydrationApplicationError("INVALID_INPUT");
  }

  const windowError = validateEventWindow(
    new Date(parsed.data.occurredAt),
    now,
  );

  if (windowError) {
    throw new HydrationApplicationError(windowError);
  }

  const { data, error } = await executeAtomicEvent(
    toProcessHydrationEventArguments(parsed.data),
  );

  if (error) {
    console.error("[HydroPOP] Atomic hydration RPC failed.", {
      code: error.code,
    });
    throw new HydrationApplicationError("INTERNAL_ERROR");
  }

  const rpcResult = rpcResultSchema.safeParse(data);

  if (!rpcResult.success) {
    console.error(
      "[HydroPOP] Atomic hydration RPC returned an invalid result.",
    );
    throw new HydrationApplicationError("INTERNAL_ERROR");
  }

  if (!rpcResult.data.ok) {
    throw new HydrationApplicationError(
      isApiErrorCode(rpcResult.data.error_code)
        ? rpcResult.data.error_code
        : "INTERNAL_ERROR",
    );
  }

  const dashboard = await getUpdatedDashboard();

  return {
    coaching: dashboard.coaching,
    daySummary: dashboard.daySummary,
    duplicate: rpcResult.data.duplicate,
    event: toHydrationEvent(rpcResult.data.event),
  };
}

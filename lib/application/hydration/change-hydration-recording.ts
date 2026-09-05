import { z } from "zod";
import {
  changeRecordingSchema,
  type ChangeRecordingArguments,
} from "@/lib/contracts/change-hydration-recording";
import {
  apiErrorCodes,
  HydrationApplicationError,
} from "@/lib/contracts/api-response";
import {
  getDateInTimezone,
  getLocalTimeInTimezone,
  localDateTimeToInstant,
} from "@/lib/domain/hydration/hydration-day";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { toStoredMilliliters } from "@/lib/units/volume";

export async function changeHydrationRecording({
  input,
  snapshot,
  execute,
  now = new Date(),
}: {
  input: unknown;
  snapshot: HydrationSnapshot;
  execute: (
    args: ChangeRecordingArguments,
  ) => Promise<{ data: unknown; error: unknown }>;
  now?: Date;
}) {
  const parsed = changeRecordingSchema.safeParse(input);
  if (!parsed.success) throw new HydrationApplicationError("INVALID_INPUT");
  const request = parsed.data;
  // Snapshot is owner-scoped by the authenticated server; SQL rechecks auth.uid().
  const original = snapshot.events.find(
    (event) => event.id === request.eventId,
  );
  if (!original || original.eventType === "event_reversed")
    throw new HydrationApplicationError("FORBIDDEN");
  let volumeMl: number | null = null;
  let occurredAt: string | null = null;
  if (request.action === "edit") {
    const timezone = snapshot.profile?.timezone;
    if (!timezone) throw new HydrationApplicationError("INVALID_INPUT");
    volumeMl = toStoredMilliliters(request.amount, request.unit);
    if (!Number.isSafeInteger(volumeMl) || volumeMl < 1 || volumeMl > 10000)
      throw new HydrationApplicationError("INVALID_INPUT");
    // Keep exact timestamp (including repeated DST hour) when the time is unchanged.
    const originalInstant = new Date(original.occurredAt);
    const instant =
      getDateInTimezone(timezone, originalInstant) === request.date &&
      getLocalTimeInTimezone(timezone, originalInstant) === request.time
        ? originalInstant
        : localDateTimeToInstant(request, timezone);
    if (
      getDateInTimezone(timezone, instant) !== request.date ||
      getLocalTimeInTimezone(timezone, instant) !== request.time
    )
      throw new HydrationApplicationError("INVALID_INPUT");
    if (instant > now) throw new HydrationApplicationError("EVENT_IN_FUTURE");
    if (instant.getTime() < now.getTime() - 3660 * 86400000)
      throw new HydrationApplicationError("INVALID_INPUT");
    occurredAt = instant.toISOString();
  }
  const result = await execute({
    p_event_id: request.eventId,
    p_action: request.action,
    p_idempotency_key: request.idempotencyKey,
    // Generated optional arguments use the RPC’s existing NULL defaults for removal.
    ...(volumeMl === null ? {} : { p_volume_ml: volumeMl }),
    ...(occurredAt === null ? {} : { p_occurred_at: occurredAt }),
  });
  if (result.error)
    throw new HydrationApplicationError("HYDRATION_WRITE_FAILED");
  const response = z
    .discriminatedUnion("ok", [
      z.object({
        ok: z.literal(true),
        duplicate: z.boolean(),
        event: z.object({ id: z.uuid() }).passthrough(),
      }),
      z.object({ ok: z.literal(false), error_code: z.enum(apiErrorCodes) }),
    ])
    .safeParse(result.data);
  if (!response.success)
    throw new HydrationApplicationError("HYDRATION_WRITE_FAILED");
  if (!response.data.ok)
    throw new HydrationApplicationError(response.data.error_code);
  return response.data;
}

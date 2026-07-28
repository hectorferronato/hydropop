import {
  processHydrationEvent,
  type AtomicHydrationEventExecutor,
} from "@/lib/application/hydration/process-hydration-event";
import { NfcApplicationError } from "@/lib/contracts/api-response";
import {
  nfcCompletionInputSchema,
  type NfcCompletionResult,
} from "@/lib/contracts/nfc";
import type { TodayDashboard } from "@/lib/contracts/dashboard";
import { reconstructEffectiveEvents } from "@/lib/domain/hydration/effective-events";
import type { HydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

import type { NfcScanResolution } from "./resolve-nfc-scan";

export const recentCompletionWindowMs = 60_000;

export function hasRecentEffectiveCompletion({
  bottleId,
  idempotencyKey,
  occurredAt,
  snapshot,
}: {
  bottleId: string;
  idempotencyKey: string;
  occurredAt: string;
  snapshot: HydrationSnapshot;
}): boolean {
  const occurredAtMs = Date.parse(occurredAt);

  return reconstructEffectiveEvents(snapshot.events).effectiveEvents.some(
    (event) => {
      const eventTimeMs = Date.parse(event.occurredAt);
      const elapsedMs = occurredAtMs - eventTimeMs;

      return (
        event.bottleId === bottleId &&
        event.eventType === "bottle_completed" &&
        event.idempotencyKey !== idempotencyKey &&
        elapsedMs >= 0 &&
        elapsedMs < recentCompletionWindowMs
      );
    },
  );
}

export async function completeNfcBottle({
  executeAtomicEvent,
  getHydrationSnapshot,
  getUpdatedDashboard,
  input,
  markConfirmed,
  now = new Date(),
  resolveToken,
}: {
  executeAtomicEvent: AtomicHydrationEventExecutor;
  getHydrationSnapshot: () => Promise<HydrationSnapshot>;
  getUpdatedDashboard: () => Promise<TodayDashboard>;
  input: unknown;
  markConfirmed: (tagId: string, eventId: string) => Promise<string>;
  now?: Date;
  resolveToken: (token: string) => Promise<NfcScanResolution | null>;
}): Promise<NfcCompletionResult> {
  const parsed = nfcCompletionInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new NfcApplicationError("INVALID_INPUT");
  }

  const resolution = await resolveToken(parsed.data.token);

  if (!resolution) {
    throw new NfcApplicationError("NFC_TAG_UNAVAILABLE");
  }

  const snapshot = await getHydrationSnapshot();
  const knownDuplicate = snapshot.events.find(
    (event) => event.idempotencyKey === parsed.data.idempotencyKey,
  );

  if (
    knownDuplicate &&
    (knownDuplicate.eventType !== "bottle_completed" ||
      knownDuplicate.source !== "nfc" ||
      knownDuplicate.bottleId !== resolution.bottle.id)
  ) {
    throw new NfcApplicationError("DUPLICATE_EVENT");
  }

  if (
    !knownDuplicate &&
    !parsed.data.confirmRecent &&
    hasRecentEffectiveCompletion({
      bottleId: resolution.bottle.id,
      idempotencyKey: parsed.data.idempotencyKey,
      occurredAt: parsed.data.occurredAt,
      snapshot,
    })
  ) {
    throw new NfcApplicationError("RECENT_COMPLETION");
  }

  const result = await processHydrationEvent({
    executeAtomicEvent,
    getUpdatedDashboard,
    input: {
      bottleId: resolution.bottle.id,
      eventType: "bottle_completed",
      idempotencyKey: parsed.data.idempotencyKey,
      occurredAt: parsed.data.occurredAt,
      source: "nfc",
    },
    now,
  });

  if (result.event.volumeMl === null || result.event.volumeMl <= 0) {
    throw new NfcApplicationError("INTERNAL_ERROR");
  }

  const lastConfirmedAt = await markConfirmed(
    resolution.tag.id,
    result.event.id,
  );

  return {
    coaching: result.coaching,
    creditedAmountMl: result.event.volumeMl,
    daySummary: result.daySummary,
    duplicate: result.duplicate,
    event: result.event,
    lastConfirmedAt,
  };
}

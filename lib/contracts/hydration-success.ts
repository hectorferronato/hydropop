import type { ProcessHydrationEventResult } from "./hydration-events";
import type { NfcCompletionResult } from "./nfc";

export type HydrationRecordingSemantic = "full" | "half";

export type HydrationSuccessPayload = {
  amountRecordedMl: number;
  completedBottleCount: number;
  goalMl: number | null;
  goalPercentage: number | null;
  isNew: boolean;
  semantic: HydrationRecordingSemantic;
  updatedDailyTotalMl: number;
};

export function toHydrationSuccessPayload(
  result: Pick<
    ProcessHydrationEventResult,
    "daySummary" | "duplicate" | "event"
  > & { action?: HydrationRecordingSemantic },
): HydrationSuccessPayload {
  if (result.event.volumeMl === null || result.event.volumeMl <= 0) {
    throw new Error("A hydration success requires a positive recorded amount.");
  }

  return {
    amountRecordedMl: result.event.volumeMl,
    completedBottleCount: result.daySummary.completedBottleCount,
    goalMl: result.daySummary.goalMl,
    goalPercentage: result.daySummary.goalPercentage,
    isNew: !result.duplicate,
    semantic:
      result.action ??
      (result.event.eventType === "bottle_completed" ? "full" : "half"),
    updatedDailyTotalMl: result.daySummary.consumedMl,
  };
}

export function toNfcHydrationSuccessPayload(
  result: NfcCompletionResult,
): HydrationSuccessPayload {
  return toHydrationSuccessPayload(result);
}

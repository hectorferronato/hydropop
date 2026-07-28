import { calculateBottleEquivalents, calculateCatchUpRate } from "./catch-up";
import {
  calculateNextCheckpoint,
  type HydrationCheckpoint,
} from "./checkpoints";
import {
  calculateExpectedIntake,
  type HydrationSchedulePhase,
} from "./expected-intake";
import {
  calculateHydrationStatus,
  type HydrationStatus,
} from "./hydration-status";
import { createCoachingMessage } from "./message";

export type HydrationCoaching = {
  bottleEquivalentsRemaining: number | null;
  expectedMl: number | null;
  message: string;
  nextCheckpoint: HydrationCheckpoint | null;
  remainingMl: number;
  requiredMlPerHour: number | null;
  schedulePhase: HydrationSchedulePhase | null;
  status: HydrationStatus;
};

export function calculateHydrationCoaching({
  bottleCapacityMl,
  consumedMl,
  date,
  goalMl,
  now,
  targetCompletionTime,
  timezone,
  wakeTime,
}: {
  bottleCapacityMl: number | null;
  consumedMl: number;
  date: string;
  goalMl: number | null;
  now: Date;
  targetCompletionTime: string | null;
  timezone: string;
  wakeTime: string | null;
}): HydrationCoaching {
  const safeConsumedMl = Math.max(0, consumedMl);
  const remainingMl = goalMl ? Math.max(0, goalMl - safeConsumedMl) : 0;
  const expected = goalMl
    ? calculateExpectedIntake({
        date,
        goalMl,
        now,
        targetCompletionTime,
        timezone,
        wakeTime,
      })
    : null;
  const status = calculateHydrationStatus({
    consumedMl: safeConsumedMl,
    expectedMl: expected?.expectedMl ?? null,
    goalMl,
  });

  return {
    bottleEquivalentsRemaining: calculateBottleEquivalents(
      remainingMl,
      bottleCapacityMl,
    ),
    expectedMl: expected?.expectedMl ?? null,
    message: createCoachingMessage({
      phase: expected?.phase ?? null,
      status,
    }),
    nextCheckpoint: calculateNextCheckpoint({
      bottleCapacityMl,
      consumedMl: safeConsumedMl,
      goalMl,
      scheduleTargetAt: expected?.targetAt ?? null,
      scheduleWakeAt: expected?.wakeAt ?? null,
    }),
    remainingMl,
    requiredMlPerHour: calculateCatchUpRate({
      consumedMl: safeConsumedMl,
      goalMl,
      now,
      targetAt: expected?.targetAt ?? null,
    }),
    schedulePhase: expected?.phase ?? null,
    status,
  };
}

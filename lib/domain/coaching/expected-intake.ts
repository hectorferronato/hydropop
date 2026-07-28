import {
  addDaysToDate,
  localDateTimeToInstant,
} from "@/lib/domain/hydration/hydration-day";

export type HydrationSchedulePhase =
  "before-wake" | "in-progress" | "after-target";

export type ExpectedIntake = {
  expectedMl: number;
  phase: HydrationSchedulePhase;
  targetAt: string;
  wakeAt: string;
};

export function calculateExpectedIntake({
  date,
  goalMl,
  now,
  targetCompletionTime,
  timezone,
  wakeTime,
}: {
  date: string;
  goalMl: number;
  now: Date;
  targetCompletionTime: string | null;
  timezone: string;
  wakeTime: string | null;
}): ExpectedIntake | null {
  if (!wakeTime || !targetCompletionTime || goalMl <= 0) {
    return null;
  }

  const wakeAt = localDateTimeToInstant({ date, time: wakeTime }, timezone);
  const targetDate =
    targetCompletionTime <= wakeTime ? addDaysToDate(date, 1) : date;
  const targetAt = localDateTimeToInstant(
    { date: targetDate, time: targetCompletionTime },
    timezone,
  );
  const nowMs = now.getTime();

  if (nowMs <= wakeAt.getTime()) {
    return {
      expectedMl: 0,
      phase: "before-wake",
      targetAt: targetAt.toISOString(),
      wakeAt: wakeAt.toISOString(),
    };
  }

  if (nowMs >= targetAt.getTime()) {
    return {
      expectedMl: goalMl,
      phase: "after-target",
      targetAt: targetAt.toISOString(),
      wakeAt: wakeAt.toISOString(),
    };
  }

  const progress =
    (nowMs - wakeAt.getTime()) / (targetAt.getTime() - wakeAt.getTime());

  return {
    expectedMl: Math.round(goalMl * progress),
    phase: "in-progress",
    targetAt: targetAt.toISOString(),
    wakeAt: wakeAt.toISOString(),
  };
}

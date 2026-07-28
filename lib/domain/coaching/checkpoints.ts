export type HydrationCheckpoint = {
  targetAt: string | null;
  targetVolumeMl: number;
};

export function calculateNextCheckpoint({
  bottleCapacityMl,
  consumedMl,
  goalMl,
  scheduleTargetAt,
  scheduleWakeAt,
}: {
  bottleCapacityMl: number | null;
  consumedMl: number;
  goalMl: number | null;
  scheduleTargetAt: string | null;
  scheduleWakeAt: string | null;
}): HydrationCheckpoint | null {
  if (
    !goalMl ||
    !bottleCapacityMl ||
    bottleCapacityMl <= 0 ||
    consumedMl >= goalMl
  ) {
    return null;
  }

  const nextMultiple =
    (Math.floor(consumedMl / bottleCapacityMl) + 1) * bottleCapacityMl;
  const targetVolumeMl = Math.min(goalMl, nextMultiple);
  let targetAt: string | null = null;

  if (scheduleWakeAt && scheduleTargetAt) {
    const wakeAtMs = Date.parse(scheduleWakeAt);
    const targetAtMs = Date.parse(scheduleTargetAt);
    const progress = targetVolumeMl / goalMl;
    targetAt = new Date(
      wakeAtMs + (targetAtMs - wakeAtMs) * progress,
    ).toISOString();
  }

  return { targetAt, targetVolumeMl };
}

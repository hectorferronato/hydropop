export type HydrationCheckpoint = {
  targetAt: string | null;
  targetVolumeMl: number;
};

export function calculateNextCheckpoint({
  normalFillMl,
  consumedMl,
  goalMl,
  scheduleTargetAt,
  scheduleWakeAt,
}: {
  normalFillMl: number | null;
  consumedMl: number;
  goalMl: number | null;
  scheduleTargetAt: string | null;
  scheduleWakeAt: string | null;
}): HydrationCheckpoint | null {
  if (!goalMl || !normalFillMl || normalFillMl <= 0 || consumedMl >= goalMl) {
    return null;
  }

  const nextMultiple =
    (Math.floor(consumedMl / normalFillMl) + 1) * normalFillMl;
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

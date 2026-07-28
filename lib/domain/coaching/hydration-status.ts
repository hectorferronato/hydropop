export type HydrationStatus =
  "ahead" | "behind" | "goal-reached" | "not-configured" | "on-track";

export function calculateHydrationStatus({
  consumedMl,
  expectedMl,
  goalMl,
}: {
  consumedMl: number;
  expectedMl: number | null;
  goalMl: number | null;
}): HydrationStatus {
  if (!goalMl) {
    return "not-configured";
  }

  if (consumedMl >= goalMl) {
    return "goal-reached";
  }

  if (expectedMl === null) {
    return "on-track";
  }

  const toleranceMl = Math.max(100, goalMl * 0.05);
  const differenceMl = consumedMl - expectedMl;

  if (differenceMl > toleranceMl) {
    return "ahead";
  }

  if (differenceMl < -toleranceMl) {
    return "behind";
  }

  return "on-track";
}

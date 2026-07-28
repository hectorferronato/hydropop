export function calculateCatchUpRate({
  consumedMl,
  goalMl,
  now,
  targetAt,
}: {
  consumedMl: number;
  goalMl: number | null;
  now: Date;
  targetAt: string | null;
}): number | null {
  if (!goalMl || !targetAt || consumedMl >= goalMl) {
    return 0;
  }

  const hoursRemaining =
    (Date.parse(targetAt) - now.getTime()) / (60 * 60 * 1_000);

  if (hoursRemaining <= 0) {
    return null;
  }

  return Math.ceil((goalMl - consumedMl) / hoursRemaining);
}

export function calculateBottleEquivalents(
  remainingMl: number,
  bottleCapacityMl: number | null,
): number | null {
  if (!bottleCapacityMl || bottleCapacityMl <= 0) {
    return null;
  }

  return Math.round((remainingMl / bottleCapacityMl) * 10) / 10;
}

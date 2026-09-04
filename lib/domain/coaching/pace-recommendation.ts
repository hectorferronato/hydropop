import type { HydrationStatus } from "./hydration-status";

export type PaceRecommendationAction = "full" | "half" | "none";

export function calculatePaceRecommendation({
  consumedMl,
  expectedMl,
  normalFillMl,
  status,
}: {
  consumedMl: number;
  expectedMl: number | null;
  normalFillMl: number | null;
  status: HydrationStatus;
}): { action: PaceRecommendationAction; amountMl: number } {
  if (
    status !== "behind" ||
    expectedMl === null ||
    !normalFillMl ||
    normalFillMl <= 0
  ) {
    return { action: "none", amountMl: 0 };
  }

  const deficitMl = Math.max(0, expectedMl - Math.max(0, consumedMl));
  const action = deficitMl >= normalFillMl * 0.75 ? "full" : "half";

  return {
    action,
    amountMl:
      action === "full"
        ? normalFillMl
        : Math.max(1, Math.round(normalFillMl / 2)),
  };
}

import type { HydrationStatus } from "./hydration-status";

export function createCoachingMessage({
  phase,
  status,
}: {
  phase: "after-target" | "before-wake" | "in-progress" | null;
  status: HydrationStatus;
}): string {
  if (status === "not-configured") {
    return "Complete your hydration plan to receive daily guidance.";
  }

  if (status === "goal-reached") {
    return "Daily goal reached. Keep listening to your body.";
  }

  if (phase === "before-wake") {
    return "Your hydration schedule has not started yet.";
  }

  if (status === "ahead") {
    return "You’re ahead of today’s pace. Keep it comfortable.";
  }

  if (status === "behind" && phase === "after-target") {
    return "Today’s target time has passed. Continue at a comfortable pace.";
  }

  if (status === "behind") {
    return "You’re behind today’s pace. The next checkpoint can help you catch up.";
  }

  return "You’re on track for today’s hydration goal.";
}

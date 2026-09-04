import type {
  PhysicalDevicePaceStatus,
  PhysicalDeviceStatusResponse,
} from "@/lib/contracts/physical-device";
import { calculateHydrationCoaching } from "@/lib/domain/coaching/coaching";
import { calculatePaceRecommendation } from "@/lib/domain/coaching/pace-recommendation";
import { parseVolumeUnit } from "@/lib/units/volume";

export type PhysicalDeviceStatusState = {
  goalMl: number | null;
  localDate: string;
  normalCompletionMl: number;
  serverTime: string;
  targetCompletionTime: string | null;
  timezone: string;
  todayMl: number;
  unit: unknown;
  wakeTime: string | null;
};

function toDevicePaceStatus(
  status: ReturnType<typeof calculateHydrationCoaching>["status"],
  schedulePhase: ReturnType<typeof calculateHydrationCoaching>["schedulePhase"],
): PhysicalDevicePaceStatus {
  if (status === "goal-reached") return "goal_met";
  if (status === "not-configured") return "not_configured";
  if (schedulePhase === "before-wake") return "before_window";
  if (schedulePhase === "after-target") return "after_window";
  if (status === "on-track") return "on_track";
  return status;
}

export function buildPhysicalDeviceStatusResponse(
  state: PhysicalDeviceStatusState,
): PhysicalDeviceStatusResponse {
  const coaching = calculateHydrationCoaching({
    normalFillMl: state.normalCompletionMl,
    consumedMl: state.todayMl,
    date: state.localDate,
    goalMl: state.goalMl,
    now: new Date(state.serverTime),
    targetCompletionTime: state.targetCompletionTime,
    timezone: state.timezone,
    wakeTime: state.wakeTime,
  });
  const recommendation = calculatePaceRecommendation({
    consumedMl: state.todayMl,
    expectedMl: coaching.expectedMl,
    normalFillMl: state.normalCompletionMl,
    status: coaching.status,
  });
  const goalComplete = state.goalMl !== null && state.todayMl >= state.goalMl;

  return {
    version: 1,
    serverTime: state.serverTime,
    unit: parseVolumeUnit(state.unit),
    todayMl: state.todayMl,
    goalMl: state.goalMl,
    progressPercent:
      state.goalMl === null
        ? 0
        : Math.max(0, Math.round((state.todayMl / state.goalMl) * 100)),
    goalComplete,
    paceStatus: toDevicePaceStatus(coaching.status, coaching.schedulePhase),
    paceDeltaMl:
      coaching.expectedMl === null ? 0 : state.todayMl - coaching.expectedMl,
    recommendedAction: recommendation.action,
    normalCompletionMl: state.normalCompletionMl,
  };
}

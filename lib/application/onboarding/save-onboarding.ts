import type { SetupInput } from "@/lib/contracts/setup";

export type SaveOnboardingArguments = {
  p_bottle_brand: string;
  p_bottle_capacity_ml: number;
  p_bottle_id?: string;
  p_bottle_is_primary: boolean;
  p_bottle_model: string;
  p_bottle_name: string;
  p_bottle_typical_fill_ml?: number;
  p_daily_goal_ml: number;
  p_display_name: string;
  p_preferred_unit: "ml" | "oz";
  p_target_completion_time: string;
  p_timezone: string;
  p_wake_time: string;
};

export function toSaveOnboardingArguments(
  input: SetupInput,
): SaveOnboardingArguments {
  const requiredArguments: SaveOnboardingArguments = {
    p_bottle_brand: input.bottleBrand,
    p_bottle_capacity_ml: input.bottleCapacityMl,
    p_bottle_is_primary: input.bottleIsPrimary,
    p_bottle_model: input.bottleModel,
    p_bottle_name: input.bottleName,
    p_daily_goal_ml: input.dailyGoalMl,
    p_display_name: input.displayName,
    p_preferred_unit: input.preferredUnit,
    p_target_completion_time: input.targetCompletionTime,
    p_timezone: input.timezone,
    p_wake_time: input.wakeTime,
  };

  return {
    ...requiredArguments,
    ...(input.bottleId ? { p_bottle_id: input.bottleId } : {}),
    ...(input.bottleTypicalFillMl === null
      ? {}
      : { p_bottle_typical_fill_ml: input.bottleTypicalFillMl }),
  };
}

import type { SetupInput } from "@/lib/contracts/setup";
import type { Database } from "@/lib/infrastructure/supabase/database.types";

export type SaveOnboardingArguments =
  Database["public"]["Functions"]["save_onboarding"]["Args"];

export function toSaveOnboardingArguments(
  input: SetupInput,
): SaveOnboardingArguments {
  return {
    p_bottle_brand: input.bottleBrand,
    p_bottle_capacity_ml: input.bottleCapacityMl,
    p_bottle_id: input.bottleId,
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
}

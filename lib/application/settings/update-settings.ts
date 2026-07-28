import type {
  BottleSettingsInput,
  HydrationSettingsInput,
  ProfileSettingsInput,
  SetupInput,
} from "@/lib/contracts/setup";
import { parseVolumeUnit } from "@/lib/units/volume";

type CurrentSettingsSnapshot = {
  bottle: {
    brand: string | null;
    capacity_ml: number;
    id: string;
    is_primary: boolean;
    model: string | null;
    name: string;
  } | null;
  goal: {
    daily_goal_ml: number;
  } | null;
  profile: {
    display_name: string | null;
    preferred_unit: unknown;
    target_completion_time: string | null;
    timezone: string;
    wake_time: string | null;
  } | null;
};

function trimTime(value: string): string {
  return value.slice(0, 5);
}

export function toCurrentSetupInput(
  snapshot: CurrentSettingsSnapshot,
): SetupInput | null {
  const { bottle, goal, profile } = snapshot;

  if (
    !bottle ||
    !goal ||
    !profile?.display_name?.trim() ||
    !profile.target_completion_time ||
    !profile.wake_time
  ) {
    return null;
  }

  return {
    bottleBrand: bottle.brand ?? "",
    bottleCapacityMl: bottle.capacity_ml,
    bottleId: bottle.id,
    bottleIsPrimary: bottle.is_primary,
    bottleModel: bottle.model ?? "",
    bottleName: bottle.name,
    dailyGoalMl: goal.daily_goal_ml,
    displayName: profile.display_name.trim(),
    preferredUnit: parseVolumeUnit(profile.preferred_unit),
    targetCompletionTime: trimTime(profile.target_completion_time),
    timezone: profile.timezone,
    wakeTime: trimTime(profile.wake_time),
  };
}

export function applyProfileSettings(
  current: SetupInput,
  profile: ProfileSettingsInput,
): SetupInput {
  return {
    ...current,
    displayName: profile.displayName,
    preferredUnit: profile.preferredUnit,
    targetCompletionTime: profile.targetCompletionTime,
    timezone: profile.timezone,
    wakeTime: profile.wakeTime,
  };
}

export function applyHydrationSettings(
  current: SetupInput,
  hydration: HydrationSettingsInput,
): SetupInput {
  return {
    ...current,
    dailyGoalMl: hydration.dailyGoalMl,
    targetCompletionTime: hydration.targetCompletionTime,
  };
}

export function applyBottleSettings(
  current: SetupInput,
  bottle: BottleSettingsInput,
): SetupInput {
  return {
    ...current,
    bottleBrand: bottle.bottleBrand,
    bottleCapacityMl: bottle.bottleCapacityMl,
    bottleModel: bottle.bottleModel,
    bottleName: bottle.bottleName,
  };
}

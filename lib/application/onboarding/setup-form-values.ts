import type { SetupFormValues } from "@/lib/contracts/setup";
import { formatDisplayVolume, parseVolumeUnit } from "@/lib/units/volume";

type SetupSnapshot = {
  bottle: {
    brand: string | null;
    capacity_ml: number;
    id: string;
    is_primary: boolean;
    model: string | null;
    name: string;
    typical_fill_ml: number | null;
  } | null;
  goal: {
    daily_goal_ml: number;
    target_completion_time: string | null;
  } | null;
  profile: {
    display_name: string | null;
    preferred_unit: string;
    target_completion_time: string | null;
    timezone: string;
    wake_time: string | null;
  } | null;
};

function trimDatabaseTime(
  value: string | null | undefined,
  fallback: string,
): string {
  return value ? value.slice(0, 5) : fallback;
}

export function toSetupFormValues(
  snapshot: SetupSnapshot,
  userEmail: string,
): SetupFormValues {
  const unit = parseVolumeUnit(snapshot.profile?.preferred_unit);

  return {
    bottleBrand: snapshot.bottle?.brand ?? "",
    bottleCapacity: formatDisplayVolume(
      snapshot.bottle?.capacity_ml ?? 710,
      unit,
    ),
    bottleId: snapshot.bottle?.id ?? "",
    bottleIsPrimary: snapshot.bottle?.is_primary ?? true,
    bottleModel: snapshot.bottle?.model ?? "",
    bottleName: snapshot.bottle?.name ?? "Everyday bottle",
    bottleTypicalFill:
      snapshot.bottle?.typical_fill_ml === null ||
      snapshot.bottle?.typical_fill_ml === undefined
        ? ""
        : formatDisplayVolume(snapshot.bottle.typical_fill_ml, unit),
    dailyGoal: formatDisplayVolume(snapshot.goal?.daily_goal_ml ?? 2130, unit),
    displayName:
      snapshot.profile?.display_name?.trim() ||
      userEmail.split("@")[0] ||
      "HydroPOP friend",
    preferredUnit: unit,
    targetCompletionTime: trimDatabaseTime(
      snapshot.profile?.target_completion_time ??
        snapshot.goal?.target_completion_time,
      "20:00",
    ),
    timezone: snapshot.profile?.timezone ?? "America/New_York",
    wakeTime: trimDatabaseTime(snapshot.profile?.wake_time, "07:00"),
  };
}

export function getSetupFormRevision(values: SetupFormValues): string {
  return JSON.stringify(values);
}

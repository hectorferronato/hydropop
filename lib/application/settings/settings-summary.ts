import { parseVolumeUnit, formatDisplayVolume } from "@/lib/units/volume";

type SettingsSnapshot = {
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
    effective_from: string;
    target_completion_time: string | null;
  } | null;
  profile: {
    display_name: string | null;
    preferred_unit: unknown;
    target_completion_time: string | null;
    timezone: string;
    wake_time: string | null;
  } | null;
};

function displayTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "Not set";
}

function displayEffectiveDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export type SettingsSummary = {
  bottle: {
    brand: string;
    capacity: string;
    id: string;
    isPrimary: boolean;
    model: string;
    name: string;
    normalFill: string;
    typicalFill: string;
  } | null;
  goal: {
    dailyGoal: string;
    effectiveDate: string;
    targetCompletionTime: string;
  } | null;
  profile: {
    displayName: string;
    preferredUnit: "ml" | "oz";
    targetCompletionTime: string;
    timezone: string;
    wakeTime: string;
  };
  unit: "ml" | "oz";
};

export function toSettingsSummary(snapshot: SettingsSnapshot): SettingsSummary {
  const unit = parseVolumeUnit(snapshot.profile?.preferred_unit);

  return {
    bottle: snapshot.bottle
      ? {
          brand: snapshot.bottle.brand ?? "Not provided",
          capacity: `${formatDisplayVolume(
            snapshot.bottle.capacity_ml,
            unit,
          )} ${unit}`,
          id: snapshot.bottle.id,
          isPrimary: snapshot.bottle.is_primary,
          model: snapshot.bottle.model ?? "Not provided",
          name: snapshot.bottle.name,
          normalFill: `${formatDisplayVolume(
            snapshot.bottle.typical_fill_ml ?? snapshot.bottle.capacity_ml,
            unit,
          )} ${unit}`,
          typicalFill:
            snapshot.bottle.typical_fill_ml === null
              ? "Not set — using full capacity"
              : `${formatDisplayVolume(
                  snapshot.bottle.typical_fill_ml,
                  unit,
                )} ${unit}`,
        }
      : null,
    goal: snapshot.goal
      ? {
          dailyGoal: `${formatDisplayVolume(
            snapshot.goal.daily_goal_ml,
            unit,
          )} ${unit}`,
          effectiveDate: displayEffectiveDate(snapshot.goal.effective_from),
          targetCompletionTime: displayTime(
            snapshot.goal.target_completion_time,
          ),
        }
      : null,
    profile: {
      displayName: snapshot.profile?.display_name?.trim() || "Not set",
      preferredUnit: unit,
      targetCompletionTime: displayTime(
        snapshot.profile?.target_completion_time,
      ),
      timezone: snapshot.profile?.timezone ?? "Not set",
      wakeTime: displayTime(snapshot.profile?.wake_time),
    },
    unit,
  };
}

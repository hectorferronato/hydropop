import { z } from "zod";

import { isValidIanaTimezone } from "@/lib/domain/hydration/hydration-day";
import { toStoredMilliliters, type VolumeUnit } from "@/lib/units/volume";

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/u, "Enter a valid time.");

const displayedVolumeSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/u, "Enter a positive number.")
  .transform(Number)
  .refine((value) => value > 0, "Enter a positive number.");

const optionalTextSchema = z
  .string()
  .trim()
  .max(80, "Use 80 characters or fewer.");

const setupFormSchema = z.object({
  bottleBrand: optionalTextSchema,
  bottleCapacity: displayedVolumeSchema,
  bottleId: z.union([z.literal(""), z.uuid()]),
  bottleIsPrimary: z
    .boolean()
    .refine(Boolean, "Choose this as your primary bottle."),
  bottleModel: optionalTextSchema,
  bottleName: z
    .string()
    .trim()
    .min(1, "Enter a bottle name.")
    .max(80, "Use 80 characters or fewer."),
  dailyGoal: displayedVolumeSchema,
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your display name.")
    .max(80, "Use 80 characters or fewer."),
  preferredUnit: z.enum(["ml", "oz"]),
  targetCompletionTime: timeSchema,
  timezone: z
    .string()
    .trim()
    .refine(isValidIanaTimezone, "Choose a valid IANA timezone."),
  wakeTime: timeSchema,
});

export type SetupField = keyof z.input<typeof setupFormSchema>;

export type SetupInput = {
  bottleBrand: string;
  bottleCapacityMl: number;
  bottleId: string | null;
  bottleIsPrimary: boolean;
  bottleModel: string;
  bottleName: string;
  dailyGoalMl: number;
  displayName: string;
  preferredUnit: VolumeUnit;
  targetCompletionTime: string;
  timezone: string;
  wakeTime: string;
};

export type SetupFormValues = {
  bottleBrand: string;
  bottleCapacity: string;
  bottleId: string;
  bottleIsPrimary: boolean;
  bottleModel: string;
  bottleName: string;
  dailyGoal: string;
  displayName: string;
  preferredUnit: VolumeUnit;
  targetCompletionTime: string;
  timezone: string;
  wakeTime: string;
};

export type SetupFormResult =
  | { data: SetupInput; success: true }
  | {
      fieldErrors: Partial<Record<SetupField, string[]>>;
      success: false;
    };

export function parseSetupFormData(formData: FormData): SetupFormResult {
  const parsed = setupFormSchema.safeParse({
    bottleBrand: formData.get("bottleBrand"),
    bottleCapacity: formData.get("bottleCapacity"),
    bottleId: formData.get("bottleId"),
    bottleIsPrimary: formData.get("bottleIsPrimary") === "on",
    bottleModel: formData.get("bottleModel"),
    bottleName: formData.get("bottleName"),
    dailyGoal: formData.get("dailyGoal"),
    displayName: formData.get("displayName"),
    preferredUnit: formData.get("preferredUnit"),
    targetCompletionTime: formData.get("targetCompletionTime"),
    timezone: formData.get("timezone"),
    wakeTime: formData.get("wakeTime"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      success: false,
    };
  }

  const preferredUnit = parsed.data.preferredUnit;
  const dailyGoalMl = toStoredMilliliters(parsed.data.dailyGoal, preferredUnit);
  const bottleCapacityMl = toStoredMilliliters(
    parsed.data.bottleCapacity,
    preferredUnit,
  );
  const volumeErrors: Partial<Record<SetupField, string[]>> = {};

  if (dailyGoalMl > 20_000) {
    volumeErrors.dailyGoal = ["Daily goal must be 20,000 ml or less."];
  }

  if (bottleCapacityMl > 10_000) {
    volumeErrors.bottleCapacity = [
      "Bottle capacity must be 10,000 ml or less.",
    ];
  }

  if (Object.keys(volumeErrors).length > 0) {
    return { fieldErrors: volumeErrors, success: false };
  }

  return {
    data: {
      bottleBrand: parsed.data.bottleBrand,
      bottleCapacityMl,
      bottleId: parsed.data.bottleId || null,
      bottleIsPrimary: parsed.data.bottleIsPrimary,
      bottleModel: parsed.data.bottleModel,
      bottleName: parsed.data.bottleName,
      dailyGoalMl,
      displayName: parsed.data.displayName,
      preferredUnit,
      targetCompletionTime: parsed.data.targetCompletionTime,
      timezone: parsed.data.timezone,
      wakeTime: parsed.data.wakeTime,
    },
    success: true,
  };
}

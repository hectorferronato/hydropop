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

const optionalDisplayedVolumeSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  displayedVolumeSchema.optional(),
);

const optionalTextSchema = z
  .string()
  .trim()
  .max(80, "Use 80 characters or fewer.");

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your display name.")
  .max(80, "Use 80 characters or fewer.");

const timezoneSchema = z
  .string()
  .trim()
  .refine(isValidIanaTimezone, "Choose a valid IANA timezone.");

const bottleNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a bottle name.")
  .max(80, "Use 80 characters or fewer.");

const setupFormSchema = z.object({
  bottleBrand: optionalTextSchema,
  bottleCapacity: displayedVolumeSchema,
  bottleId: z.union([z.literal(""), z.uuid()]),
  bottleIsPrimary: z
    .boolean()
    .refine(Boolean, "Choose this as your primary bottle."),
  bottleModel: optionalTextSchema,
  bottleName: bottleNameSchema,
  bottleTypicalFill: optionalDisplayedVolumeSchema,
  dailyGoal: displayedVolumeSchema,
  displayName: displayNameSchema,
  preferredUnit: z.enum(["ml", "oz"]),
  targetCompletionTime: timeSchema,
  timezone: timezoneSchema,
  wakeTime: timeSchema,
});

const profileSettingsSchema = setupFormSchema.pick({
  displayName: true,
  preferredUnit: true,
  targetCompletionTime: true,
  timezone: true,
  wakeTime: true,
});

const hydrationSettingsSchema = setupFormSchema.pick({
  dailyGoal: true,
  targetCompletionTime: true,
});

const bottleSettingsSchema = setupFormSchema.pick({
  bottleBrand: true,
  bottleCapacity: true,
  bottleModel: true,
  bottleName: true,
  bottleTypicalFill: true,
});

export type SetupField = keyof z.input<typeof setupFormSchema>;
export type ProfileSettingsField = keyof z.input<typeof profileSettingsSchema>;
export type HydrationSettingsField = keyof z.input<
  typeof hydrationSettingsSchema
>;
export type BottleSettingsField = keyof z.input<typeof bottleSettingsSchema>;

export type SetupInput = {
  bottleBrand: string;
  bottleCapacityMl: number;
  bottleId: string | null;
  bottleIsPrimary: boolean;
  bottleModel: string;
  bottleName: string;
  bottleTypicalFillMl: number | null;
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
  bottleTypicalFill: string;
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

type SettingsFormResult<Data, Field extends string> =
  | { data: Data; success: true }
  | {
      fieldErrors: Partial<Record<Field, string[]>>;
      success: false;
    };

export type ProfileSettingsInput = z.output<typeof profileSettingsSchema>;

export type HydrationSettingsInput = {
  dailyGoalMl: number;
  targetCompletionTime: string;
};

export type BottleSettingsInput = {
  bottleBrand: string;
  bottleCapacityMl: number;
  bottleModel: string;
  bottleName: string;
  bottleTypicalFillMl: number | null;
};

export function parseProfileSettingsFormData(
  formData: FormData,
): SettingsFormResult<ProfileSettingsInput, ProfileSettingsField> {
  const parsed = profileSettingsSchema.safeParse({
    displayName: formData.get("displayName"),
    preferredUnit: formData.get("preferredUnit"),
    targetCompletionTime: formData.get("targetCompletionTime"),
    timezone: formData.get("timezone"),
    wakeTime: formData.get("wakeTime"),
  });

  return parsed.success
    ? { data: parsed.data, success: true }
    : {
        fieldErrors: parsed.error.flatten().fieldErrors,
        success: false,
      };
}

export function parseHydrationSettingsFormData(
  formData: FormData,
  unit: VolumeUnit,
): SettingsFormResult<HydrationSettingsInput, HydrationSettingsField> {
  const parsed = hydrationSettingsSchema.safeParse({
    dailyGoal: formData.get("dailyGoal"),
    targetCompletionTime: formData.get("targetCompletionTime"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      success: false,
    };
  }

  const dailyGoalMl = toStoredMilliliters(parsed.data.dailyGoal, unit);

  if (dailyGoalMl > 20_000) {
    return {
      fieldErrors: {
        dailyGoal: ["Daily goal must be 20,000 ml or less."],
      },
      success: false,
    };
  }

  return {
    data: {
      dailyGoalMl,
      targetCompletionTime: parsed.data.targetCompletionTime,
    },
    success: true,
  };
}

export function parseBottleSettingsFormData(
  formData: FormData,
  unit: VolumeUnit,
): SettingsFormResult<BottleSettingsInput, BottleSettingsField> {
  const parsed = bottleSettingsSchema.safeParse({
    bottleBrand: formData.get("bottleBrand"),
    bottleCapacity: formData.get("bottleCapacity"),
    bottleModel: formData.get("bottleModel"),
    bottleName: formData.get("bottleName"),
    bottleTypicalFill: formData.get("bottleTypicalFill"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      success: false,
    };
  }

  const bottleCapacityMl = toStoredMilliliters(
    parsed.data.bottleCapacity,
    unit,
  );
  const bottleTypicalFillMl =
    parsed.data.bottleTypicalFill === undefined
      ? null
      : toStoredMilliliters(parsed.data.bottleTypicalFill, unit);

  if (bottleCapacityMl > 10_000) {
    return {
      fieldErrors: {
        bottleCapacity: ["Bottle capacity must be 10,000 ml or less."],
      },
      success: false,
    };
  }

  if (bottleTypicalFillMl !== null && bottleTypicalFillMl > bottleCapacityMl) {
    return {
      fieldErrors: {
        bottleTypicalFill: [
          "Typical fill amount cannot exceed bottle capacity.",
        ],
      },
      success: false,
    };
  }

  return {
    data: {
      bottleBrand: parsed.data.bottleBrand,
      bottleCapacityMl,
      bottleModel: parsed.data.bottleModel,
      bottleName: parsed.data.bottleName,
      bottleTypicalFillMl,
    },
    success: true,
  };
}

export function parseSetupFormData(formData: FormData): SetupFormResult {
  const parsed = setupFormSchema.safeParse({
    bottleBrand: formData.get("bottleBrand"),
    bottleCapacity: formData.get("bottleCapacity"),
    bottleId: formData.get("bottleId"),
    bottleIsPrimary: formData.get("bottleIsPrimary") === "on",
    bottleModel: formData.get("bottleModel"),
    bottleName: formData.get("bottleName"),
    bottleTypicalFill: formData.get("bottleTypicalFill"),
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
  const bottleTypicalFillMl =
    parsed.data.bottleTypicalFill === undefined
      ? null
      : toStoredMilliliters(parsed.data.bottleTypicalFill, preferredUnit);
  const volumeErrors: Partial<Record<SetupField, string[]>> = {};

  if (dailyGoalMl > 20_000) {
    volumeErrors.dailyGoal = ["Daily goal must be 20,000 ml or less."];
  }

  if (bottleCapacityMl > 10_000) {
    volumeErrors.bottleCapacity = [
      "Bottle capacity must be 10,000 ml or less.",
    ];
  }

  if (bottleTypicalFillMl !== null && bottleTypicalFillMl > bottleCapacityMl) {
    volumeErrors.bottleTypicalFill = [
      "Typical fill amount cannot exceed bottle capacity.",
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
      bottleTypicalFillMl,
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

import { z } from "zod";

import { isValidIanaTimezone } from "@/lib/domain/hydration/hydration-day";

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);

export const updateSettingsInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    preferredUnit: z.enum(["ml", "oz"]).optional(),
    targetCompletionTime: timeSchema.optional(),
    timezone: z
      .string()
      .refine(isValidIanaTimezone, "Choose a valid IANA timezone.")
      .optional(),
    wakeTime: timeSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0);

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

import { z } from "zod";

import type { Database } from "@/lib/infrastructure/supabase/database.types";

const identity = {
  eventId: z.uuid(),
  idempotencyKey: z.uuid(),
};
export const changeRecordingSchema = z.discriminatedUnion("action", [
  z.object({ ...identity, action: z.literal("remove") }).strict(),
  z
    .object({
      ...identity,
      action: z.literal("edit"),
      amount: z.number().finite().positive(),
      unit: z.enum(["ml", "oz"]),
      date: z.iso.date(),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/u),
    })
    .strict(),
]);
export type ChangeRecordingInput = z.infer<typeof changeRecordingSchema>;
export type ChangeRecordingArguments =
  Database["public"]["Functions"]["change_hydration_recording"]["Args"];

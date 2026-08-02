import { z } from "zod";

import type { HydrationSuccessPayload } from "./hydration-success";

export const manualHydrationInputSchema = z
  .object({
    action: z.enum(["full", "half"]),
    idempotencyKey: z.string().trim().min(8).max(200),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ManualHydrationInput = z.infer<typeof manualHydrationInputSchema>;
export type ManualHydrationResult = HydrationSuccessPayload;

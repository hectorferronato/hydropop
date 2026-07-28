import { z } from "zod";

export const createBottleInputSchema = z.object({
  brand: z.string().trim().max(80).nullable().optional(),
  capacityMl: z.int().positive().max(10_000),
  isPrimary: z.boolean().optional().default(false),
  model: z.string().trim().max(80).nullable().optional(),
  name: z.string().trim().min(1).max(80),
});

export type CreateBottleInput = z.infer<typeof createBottleInputSchema>;

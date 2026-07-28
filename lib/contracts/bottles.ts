import { z } from "zod";

export const createBottleInputSchema = z
  .object({
    brand: z.string().trim().max(80).nullable().optional(),
    capacityMl: z.int().positive().max(10_000),
    isPrimary: z.boolean().optional().default(false),
    model: z.string().trim().max(80).nullable().optional(),
    name: z.string().trim().min(1).max(80),
    typicalFillMl: z.int().positive().max(10_000).nullable().optional(),
  })
  .superRefine((input, context) => {
    if (
      input.typicalFillMl !== null &&
      input.typicalFillMl !== undefined &&
      input.typicalFillMl > input.capacityMl
    ) {
      context.addIssue({
        code: "custom",
        message: "Typical fill cannot exceed capacity.",
        path: ["typicalFillMl"],
      });
    }
  });

export type CreateBottleInput = z.infer<typeof createBottleInputSchema>;

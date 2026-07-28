import { z } from "zod";

import {
  clientHydrationEventTypes,
  hydrationSources,
  type HydrationEvent,
} from "@/lib/domain/hydration/event-types";

const hydrationEventInputBaseSchema = z.object({
  bottleId: z.uuid(),
  deviceId: z.uuid().nullable().optional(),
  eventType: z.enum(clientHydrationEventTypes),
  idempotencyKey: z.string().trim().min(8).max(200),
  occurredAt: z.iso.datetime({ offset: true }),
  reversesEventId: z.uuid().nullable().optional(),
  source: z.enum(hydrationSources),
  volumeMl: z.int().safe().nullable().optional(),
});

export const hydrationEventInputSchema =
  hydrationEventInputBaseSchema.superRefine((input, context) => {
    if (
      input.eventType === "bottle_completed" &&
      input.volumeMl !== null &&
      input.volumeMl !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Bottle completion uses the bottle’s normal fill amount.",
        path: ["volumeMl"],
      });
    }

    if (
      input.eventType === "manual_intake" &&
      (!input.volumeMl || input.volumeMl <= 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Manual intake requires a positive volume.",
        path: ["volumeMl"],
      });
    }

    if (
      input.eventType === "adjustment" &&
      (input.volumeMl === null ||
        input.volumeMl === undefined ||
        input.volumeMl === 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Adjustment requires a non-zero signed volume.",
        path: ["volumeMl"],
      });
    }

    if (input.eventType === "event_reversed" && !input.reversesEventId) {
      context.addIssue({
        code: "custom",
        message: "A reversal must reference an event.",
        path: ["reversesEventId"],
      });
    }

    if (
      input.eventType !== "event_reversed" &&
      input.reversesEventId !== null &&
      input.reversesEventId !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Only a reversal may reference another event.",
        path: ["reversesEventId"],
      });
    }
  });

export type HydrationEventInput = z.infer<typeof hydrationEventInputSchema>;

export type ProcessHydrationEventResult = {
  coaching: import("@/lib/domain/coaching/coaching").HydrationCoaching;
  daySummary: import("@/lib/domain/hydration/daily-summary").HydrationDaySummary;
  duplicate: boolean;
  event: HydrationEvent;
};

import { z } from "zod";

import { validateNfcFriendlyCode } from "./nfc-friendly-code";

const labelSchema = z.string().trim().max(80);
const friendlyCodeSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value, context) => {
    if (!value?.trim()) {
      return null;
    }

    const validation = validateNfcFriendlyCode(value);

    if (validation.error) {
      context.addIssue({
        code: "custom",
        message: validation.error,
      });
      return z.NEVER;
    }

    return validation.code;
  });

export const createNfcTagInputSchema = z
  .object({
    bottleId: z.uuid(),
    friendlyCode: friendlyCodeSchema,
    label: labelSchema.nullable().optional(),
  })
  .strict();

export const updateNfcTagInputSchema = z
  .object({
    bottleId: z.uuid(),
    friendlyCode: friendlyCodeSchema,
    label: labelSchema.nullable(),
  })
  .strict();

export const nfcCompletionInputSchema = z
  .object({
    confirmRecent: z.boolean().optional().default(false),
    idempotencyKey: z.string().trim().min(8).max(200),
    occurredAt: z.iso.datetime({ offset: true }),
    identifier: z.string().trim().min(3).max(43),
  })
  .strict();

export type NfcBottleSummary = {
  brand: string | null;
  capacityMl: number;
  id: string;
  isPrimary: boolean;
  model: string | null;
  name: string;
  normalFillMl: number;
  typicalFillMl: number | null;
};

export type NfcTagSummary = {
  bottle: NfcBottleSummary;
  createdAt: string;
  friendlyCode: string | null;
  id: string;
  label: string | null;
  lastConfirmedAt: string | null;
  status: string;
};

export type IssuedNfcCredential = {
  friendlyUrl: string | null;
  rawToken: string;
  secureUrl: string;
  tag: NfcTagSummary;
};

export type NfcTagList = {
  assignableBottles: NfcBottleSummary[];
  friendlyCodeReservations: Array<{
    code: string;
    tagId: string;
  }>;
  tags: NfcTagSummary[];
};

export type NfcCompletionResult = {
  coaching: import("@/lib/domain/coaching/coaching").HydrationCoaching;
  creditedAmountMl: number;
  daySummary: import("@/lib/domain/hydration/daily-summary").HydrationDaySummary;
  duplicate: boolean;
  event: import("@/lib/domain/hydration/event-types").HydrationEvent;
  lastConfirmedAt: string;
};

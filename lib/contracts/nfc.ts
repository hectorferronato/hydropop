import { z } from "zod";

import { isValidPublicNfcToken } from "./nfc-token";

const labelSchema = z.string().trim().max(80);

export const createNfcTagInputSchema = z
  .object({
    bottleId: z.uuid(),
    label: labelSchema.nullable().optional(),
  })
  .strict();

export const updateNfcTagInputSchema = z
  .object({
    bottleId: z.uuid(),
    label: labelSchema.nullable(),
  })
  .strict();

export const nfcCompletionInputSchema = z
  .object({
    confirmRecent: z.boolean().optional().default(false),
    idempotencyKey: z.string().trim().min(8).max(200),
    occurredAt: z.iso.datetime({ offset: true }),
    token: z.string().refine(isValidPublicNfcToken),
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
  id: string;
  label: string | null;
  lastConfirmedAt: string | null;
  status: string;
};

export type IssuedNfcCredential = {
  nfcUrl: string;
  rawToken: string;
  tag: NfcTagSummary;
};

export type NfcTagList = {
  assignableBottles: NfcBottleSummary[];
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

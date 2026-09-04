import { z } from "zod";

import type { VolumeUnit } from "@/lib/units/volume";

export const physicalDeviceTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
export const physicalDeviceIdempotencyKeyPattern =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export function isValidPhysicalDeviceToken(token: string): boolean {
  return physicalDeviceTokenPattern.test(token);
}

const utcTimestampSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), "Timestamp must use UTC (Z).");

export const physicalDeviceHydrationInputSchema = z
  .object({
    action: z.literal("bottle_completed"),
    idempotencyKey: z.string().regex(physicalDeviceIdempotencyKeyPattern),
    occurredAt: utcTimestampSchema.optional(),
  })
  .strict();

export const createPhysicalDeviceInputSchema = z
  .object({
    bottleId: z.uuid(),
    label: z.string().trim().min(1).max(80),
  })
  .strict();

export const updatePhysicalDeviceInputSchema = createPhysicalDeviceInputSchema;

export type PhysicalDeviceSummary = {
  bottleId: string;
  createdAt: string;
  id: string;
  label: string;
  lastSeenAt: string | null;
  lastSuccessfulSyncAt: string | null;
  revokedAt: string | null;
  status: "active" | "revoked";
};

export type PhysicalDeviceBottleSummary = {
  capacityMl: number;
  id: string;
  name: string;
  normalCompletionMl: number;
  typicalFillMl: number | null;
};

export type PhysicalDeviceList = {
  assignableBottles: PhysicalDeviceBottleSummary[];
  devices: PhysicalDeviceSummary[];
};

export type IssuedPhysicalDeviceCredential = {
  device: PhysicalDeviceSummary;
  rawToken: string;
};

export type PhysicalDevicePaceStatus =
  | "ahead"
  | "after_window"
  | "before_window"
  | "behind"
  | "goal_met"
  | "not_configured"
  | "on_track";

export type PhysicalDeviceStatusResponse = {
  goalComplete: boolean;
  goalMl: number | null;
  normalCompletionMl: number;
  paceDeltaMl: number;
  paceStatus: PhysicalDevicePaceStatus;
  progressPercent: number;
  recommendedAction: "full" | "half" | "none";
  serverTime: string;
  todayMl: number;
  unit: VolumeUnit;
  version: 1;
};

export type PhysicalDeviceHydrationResponse = PhysicalDeviceStatusResponse & {
  recordedMl: number;
  result: "created" | "existing";
};

export type PhysicalDeviceErrorCode =
  | "DEVICE_CONFIGURATION_ERROR"
  | "EVENT_IN_FUTURE"
  | "EVENT_TOO_OLD"
  | "INTERNAL_ERROR"
  | "INVALID_INPUT"
  | "UNAUTHORIZED";

export type PhysicalDeviceErrorResponse = {
  error: {
    code: PhysicalDeviceErrorCode;
    message: string;
  };
  serverTime: string;
  version: 1;
};

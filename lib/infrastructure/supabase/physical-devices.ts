import { createServerClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";

import type { PhysicalDeviceStatusState } from "@/lib/application/device/build-device-status";
import type {
  PhysicalDeviceBottleSummary,
  PhysicalDeviceHydrationResponse,
  PhysicalDeviceList,
  PhysicalDeviceSummary,
} from "@/lib/contracts/physical-device";

import type { Database } from "./database.types";
import { getPhysicalDeviceRpcSecret } from "./physical-device-config";
import { getPublicSupabaseConfig } from "./public-env";

const physicalDeviceSummarySchema = z.object({
  bottleId: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
  label: z.string().min(1).max(80),
  lastSeenAt: z.iso.datetime({ offset: true }).nullable(),
  lastSuccessfulSyncAt: z.iso.datetime({ offset: true }).nullable(),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
  status: z.enum(["active", "revoked"]),
});

const physicalDeviceListSchema = z.object({
  devices: z.array(physicalDeviceSummarySchema),
});

const statusStateSchema = z.object({
  goalMl: z.number().int().positive().nullable(),
  localDate: z.iso.date(),
  normalCompletionMl: z.number().int().positive(),
  ok: z.literal(true),
  serverTime: z.iso.datetime({ offset: true }),
  targetCompletionTime: z.string().nullable(),
  timezone: z.string().min(1),
  todayMl: z.number().int().nonnegative(),
  unit: z.unknown(),
  wakeTime: z.string().nullable(),
});

const statusFailureSchema = z.object({
  error_code: z.string(),
  ok: z.literal(false),
});

const statusRpcSchema = z.discriminatedUnion("ok", [
  statusStateSchema,
  statusFailureSchema,
]);

const hydrationRpcSchema = z.discriminatedUnion("ok", [
  statusStateSchema.extend({
    recordedMl: z.number().int().positive(),
    result: z.enum(["created", "existing"]),
  }),
  statusFailureSchema,
]);

export type PhysicalDeviceRpcFailure = {
  errorCode: string;
  ok: false;
};

export type PhysicalDeviceStatusRpcResult =
  { ok: true; state: PhysicalDeviceStatusState } | PhysicalDeviceRpcFailure;

export type PhysicalDeviceHydrationRpcResult =
  | {
      ok: true;
      recordedMl: number;
      result: PhysicalDeviceHydrationResponse["result"];
      state: PhysicalDeviceStatusState;
    }
  | PhysicalDeviceRpcFailure;

export class PhysicalDeviceDataError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Unable to access physical-device data.");
    this.code = code;
    this.name = "PhysicalDeviceDataError";
  }
}

function parseSummary(data: unknown): PhysicalDeviceSummary {
  const parsed = physicalDeviceSummarySchema.safeParse(data);

  if (!parsed.success) {
    throw new PhysicalDeviceDataError("INVALID_RESULT");
  }

  return parsed.data;
}

function toStatusState(
  value: z.infer<typeof statusStateSchema>,
): PhysicalDeviceStatusState {
  return {
    goalMl: value.goalMl,
    localDate: value.localDate,
    normalCompletionMl: value.normalCompletionMl,
    serverTime: value.serverTime,
    targetCompletionTime: value.targetCompletionTime,
    timezone: value.timezone,
    todayMl: value.todayMl,
    unit: value.unit,
    wakeTime: value.wakeTime,
  };
}

export async function createPhysicalDeviceManagementClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes them.
        }
      },
    },
  });
}

export function createPhysicalDeviceApiClient() {
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createSupabaseClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getPhysicalDeviceList(
  client: Awaited<ReturnType<typeof createPhysicalDeviceManagementClient>>,
  queryClient: SupabaseClient<Database>,
  userId: string,
): Promise<PhysicalDeviceList> {
  const [devicesResult, bottlesResult] = await Promise.all([
    client.rpc("list_physical_button_devices"),
    queryClient
      .from("bottles")
      .select("capacity_ml, id, name, typical_fill_ml")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (devicesResult.error) {
    throw new PhysicalDeviceDataError(devicesResult.error.code);
  }

  if (bottlesResult.error) {
    throw new PhysicalDeviceDataError(bottlesResult.error.code);
  }

  const parsed = physicalDeviceListSchema.safeParse(devicesResult.data);

  if (!parsed.success) {
    throw new PhysicalDeviceDataError("INVALID_RESULT");
  }

  const assignableBottles: PhysicalDeviceBottleSummary[] = (
    bottlesResult.data ?? []
  ).map((bottle) => ({
    capacityMl: bottle.capacity_ml,
    id: bottle.id,
    name: bottle.name,
    normalCompletionMl: bottle.typical_fill_ml ?? bottle.capacity_ml,
    typicalFillMl: bottle.typical_fill_ml,
  }));

  return { assignableBottles, devices: parsed.data.devices };
}

export async function createPhysicalDevice(
  client: Awaited<ReturnType<typeof createPhysicalDeviceManagementClient>>,
  input: { bottleId: string; credentialHash: string; label: string },
): Promise<{
  data: PhysicalDeviceSummary | null;
  error: { code: string } | null;
}> {
  const result = await client.rpc("create_physical_button_device", {
    p_bottle_id: input.bottleId,
    p_credential_hash: input.credentialHash,
    p_label: input.label,
  });

  if (result.error) return { data: null, error: { code: result.error.code } };

  return { data: parseSummary(result.data), error: null };
}

export async function updatePhysicalDevice(
  client: Awaited<ReturnType<typeof createPhysicalDeviceManagementClient>>,
  input: { bottleId: string; deviceId: string; label: string },
): Promise<PhysicalDeviceSummary> {
  const { data, error } = await client.rpc("update_physical_button_device", {
    p_bottle_id: input.bottleId,
    p_device_id: input.deviceId,
    p_label: input.label,
  });

  if (error) throw new PhysicalDeviceDataError(error.code);
  return parseSummary(data);
}

export async function revokePhysicalDevice(
  client: Awaited<ReturnType<typeof createPhysicalDeviceManagementClient>>,
  deviceId: string,
): Promise<PhysicalDeviceSummary> {
  const { data, error } = await client.rpc("revoke_physical_button_device", {
    p_device_id: deviceId,
  });

  if (error) throw new PhysicalDeviceDataError(error.code);
  return parseSummary(data);
}

export async function getPhysicalDeviceStatus(
  credentialHash: string,
): Promise<PhysicalDeviceStatusRpcResult> {
  const { data, error } = await createPhysicalDeviceApiClient().rpc(
    "get_physical_button_status",
    {
      p_api_secret: getPhysicalDeviceRpcSecret(),
      p_credential_hash: credentialHash,
    },
  );

  if (error) throw new PhysicalDeviceDataError(error.code);

  const parsed = statusRpcSchema.safeParse(data);
  if (!parsed.success) throw new PhysicalDeviceDataError("INVALID_RESULT");

  return parsed.data.ok
    ? { ok: true, state: toStatusState(parsed.data) }
    : { errorCode: parsed.data.error_code, ok: false };
}

export async function recordPhysicalDeviceHydration(input: {
  credentialHash: string;
  idempotencyKey: string;
  occurredAt: string;
}): Promise<PhysicalDeviceHydrationRpcResult> {
  const { data, error } = await createPhysicalDeviceApiClient().rpc(
    "record_physical_button_hydration",
    {
      p_api_secret: getPhysicalDeviceRpcSecret(),
      p_credential_hash: input.credentialHash,
      p_idempotency_key: input.idempotencyKey,
      p_occurred_at: input.occurredAt,
    },
  );

  if (error) throw new PhysicalDeviceDataError(error.code);

  const parsed = hydrationRpcSchema.safeParse(data);
  if (!parsed.success) throw new PhysicalDeviceDataError("INVALID_RESULT");

  return parsed.data.ok
    ? {
        ok: true,
        recordedMl: parsed.data.recordedMl,
        result: parsed.data.result,
        state: toStatusState(parsed.data),
      }
    : { errorCode: parsed.data.error_code, ok: false };
}

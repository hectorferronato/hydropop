import { getPhysicalDeviceCredentialHash } from "@/lib/application/device/authenticate-device-request";
import { buildPhysicalDeviceStatusResponse } from "@/lib/application/device/build-device-status";
import {
  physicalDeviceFailure,
  physicalDeviceRpcFailure,
  physicalDeviceSuccess,
} from "@/lib/application/device/device-api-response";
import { revalidateHydrationViews } from "@/lib/application/hydration/revalidate-hydration-views";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import { physicalDeviceHydrationInputSchema } from "@/lib/contracts/physical-device";
import { validateEventWindow } from "@/lib/domain/hydration/event-window";
import {
  PhysicalDeviceDataError,
  recordPhysicalDeviceHydration,
} from "@/lib/infrastructure/supabase/physical-devices";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const credentialHash = getPhysicalDeviceCredentialHash(
    request.headers.get("authorization"),
  );

  if (!credentialHash) {
    return physicalDeviceFailure("UNAUTHORIZED", 401);
  }

  const parsed = physicalDeviceHydrationInputSchema.safeParse(
    await readBoundedJson(request, 2_048),
  );

  if (!parsed.success) {
    return physicalDeviceFailure("INVALID_INPUT", 400);
  }

  const receiptTime = new Date();
  const occurredAt = parsed.data.occurredAt ?? receiptTime.toISOString();
  const windowError = validateEventWindow(new Date(occurredAt), receiptTime);

  if (windowError) {
    return physicalDeviceFailure(windowError, 422);
  }

  try {
    const result = await recordPhysicalDeviceHydration({
      credentialHash,
      idempotencyKey: parsed.data.idempotencyKey,
      occurredAt,
    });

    if (!result.ok) {
      return physicalDeviceRpcFailure(result.errorCode);
    }

    if (result.result === "created") {
      revalidateHydrationViews();
    }

    return physicalDeviceSuccess(
      {
        ...buildPhysicalDeviceStatusResponse(result.state),
        recordedMl: result.recordedMl,
        result: result.result,
      },
      result.result === "created" ? 201 : 200,
    );
  } catch (error) {
    console.error("[HydroPOP] Physical-device hydration failed safely.", {
      code: error instanceof PhysicalDeviceDataError ? error.code : "UNKNOWN",
    });
    return physicalDeviceFailure("INTERNAL_ERROR", 500);
  }
}

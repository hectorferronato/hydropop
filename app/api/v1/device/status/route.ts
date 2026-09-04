import { buildPhysicalDeviceStatusResponse } from "@/lib/application/device/build-device-status";
import { getPhysicalDeviceCredentialHash } from "@/lib/application/device/authenticate-device-request";
import {
  physicalDeviceFailure,
  physicalDeviceRpcFailure,
  physicalDeviceSuccess,
} from "@/lib/application/device/device-api-response";
import {
  getPhysicalDeviceStatus,
  PhysicalDeviceDataError,
} from "@/lib/infrastructure/supabase/physical-devices";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const credentialHash = getPhysicalDeviceCredentialHash(
    request.headers.get("authorization"),
  );

  if (!credentialHash) {
    return physicalDeviceFailure("UNAUTHORIZED", 401);
  }

  try {
    const result = await getPhysicalDeviceStatus(credentialHash);

    if (!result.ok) {
      return physicalDeviceRpcFailure(result.errorCode);
    }

    return physicalDeviceSuccess(
      buildPhysicalDeviceStatusResponse(result.state),
    );
  } catch (error) {
    console.error("[HydroPOP] Physical-device status failed safely.", {
      code: error instanceof PhysicalDeviceDataError ? error.code : "UNKNOWN",
    });
    return physicalDeviceFailure("INTERNAL_ERROR", 500);
  }
}

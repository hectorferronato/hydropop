import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  createPhysicalDeviceManagementClient,
  PhysicalDeviceDataError,
  revokePhysicalDevice,
} from "@/lib/infrastructure/supabase/physical-devices";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return apiFailure("INVALID_INPUT");

  try {
    return apiSuccess(
      await revokePhysicalDevice(
        await createPhysicalDeviceManagementClient(),
        id,
      ),
    );
  } catch (error) {
    if (error instanceof PhysicalDeviceDataError && error.code === "P0002") {
      return apiFailure("DEVICE_NOT_FOUND");
    }
    return apiFailure("INTERNAL_ERROR");
  }
}

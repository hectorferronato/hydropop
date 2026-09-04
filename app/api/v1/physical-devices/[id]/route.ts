import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import { updatePhysicalDeviceInputSchema } from "@/lib/contracts/physical-device";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  createPhysicalDeviceManagementClient,
  PhysicalDeviceDataError,
  updatePhysicalDevice,
} from "@/lib/infrastructure/supabase/physical-devices";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const [{ id }, input] = await Promise.all([
    context.params,
    readBoundedJson(request, 2_048),
  ]);
  const parsedId = /^[0-9a-f-]{36}$/iu.test(id);
  const parsed = updatePhysicalDeviceInputSchema.safeParse(input);

  if (!parsedId || !parsed.success) {
    return apiFailure("INVALID_INPUT");
  }

  try {
    return apiSuccess(
      await updatePhysicalDevice(await createPhysicalDeviceManagementClient(), {
        bottleId: parsed.data.bottleId,
        deviceId: id,
        label: parsed.data.label,
      }),
    );
  } catch (error) {
    if (error instanceof PhysicalDeviceDataError && error.code === "P0002") {
      return apiFailure("DEVICE_NOT_FOUND");
    }
    return apiFailure("INTERNAL_ERROR");
  }
}

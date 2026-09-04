import {
  issuePhysicalDeviceCredential,
  PhysicalDeviceCredentialIssueError,
} from "@/lib/application/device/issue-physical-device-credential";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import {
  createPhysicalDeviceInputSchema,
  type IssuedPhysicalDeviceCredential,
} from "@/lib/contracts/physical-device";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  createPhysicalDevice,
  createPhysicalDeviceManagementClient,
  getPhysicalDeviceList,
} from "@/lib/infrastructure/supabase/physical-devices";
import { createClient } from "@/lib/infrastructure/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  try {
    return apiSuccess(
      await getPhysicalDeviceList(
        await createPhysicalDeviceManagementClient(),
        await createClient(),
        authentication.user.id,
      ),
    );
  } catch {
    return apiFailure("INTERNAL_ERROR");
  }
}

export async function POST(request: Request) {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const parsed = createPhysicalDeviceInputSchema.safeParse(
    await readBoundedJson(request, 2_048),
  );

  if (!parsed.success) {
    return apiFailure("INVALID_INPUT");
  }

  try {
    const client = await createPhysicalDeviceManagementClient();
    const issued = await issuePhysicalDeviceCredential({
      mutate: async (credentialHash) =>
        await createPhysicalDevice(client, {
          bottleId: parsed.data.bottleId,
          credentialHash,
          label: parsed.data.label,
        }),
    });
    const response: IssuedPhysicalDeviceCredential = {
      device: issued.data,
      rawToken: issued.rawToken,
    };

    return apiSuccess(response, 201);
  } catch (error) {
    if (
      error instanceof PhysicalDeviceCredentialIssueError &&
      error.code === "P0002"
    ) {
      return apiFailure("BOTTLE_NOT_FOUND");
    }

    console.error("[HydroPOP] Physical-device creation failed safely.", {
      code:
        error instanceof PhysicalDeviceCredentialIssueError
          ? error.code
          : "UNKNOWN",
    });
    return apiFailure("INTERNAL_ERROR");
  }
}

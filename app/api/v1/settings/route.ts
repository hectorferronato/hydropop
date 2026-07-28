import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { updateSettingsInputSchema } from "@/lib/contracts/settings-api";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
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
      await getOnboardingSnapshot(await createClient(), authentication.user.id),
    );
  } catch {
    return apiFailure("INTERNAL_ERROR");
  }
}

export async function PUT(request: Request) {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiFailure("INVALID_INPUT");
  }

  const parsed = updateSettingsInputSchema.safeParse(body);

  if (!parsed.success) {
    return apiFailure("INVALID_INPUT");
  }

  const update = {
    ...(parsed.data.displayName
      ? { display_name: parsed.data.displayName }
      : {}),
    ...(parsed.data.preferredUnit
      ? { preferred_unit: parsed.data.preferredUnit }
      : {}),
    ...(parsed.data.targetCompletionTime
      ? { target_completion_time: parsed.data.targetCompletionTime }
      : {}),
    ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}),
    ...(parsed.data.wakeTime ? { wake_time: parsed.data.wakeTime } : {}),
  };
  const { data, error } = await (
    await createClient()
  )
    .from("profiles")
    .update(update)
    .eq("id", authentication.user.id)
    .select(
      "display_name, preferred_unit, target_completion_time, timezone, wake_time",
    )
    .single();

  if (error) {
    console.error("[HydroPOP] Settings API update failed.", {
      code: error.code,
    });
    return apiFailure("INTERNAL_ERROR");
  }

  return apiSuccess(data);
}

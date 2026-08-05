import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import { notificationPreferenceInputSchema } from "@/lib/contracts/push-notifications";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createPushServerClient } from "@/lib/infrastructure/supabase/push-server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const authentication = await getAllowedUser();
  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const parsed = notificationPreferenceInputSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) return apiFailure("INVALID_INPUT");

  const { error } = await (
    await createPushServerClient()
  )
    .from("hydration_notification_preferences")
    .upsert(
      {
        pace_reminders_enabled: parsed.data.paceRemindersEnabled,
        user_id: authentication.user.id,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[HydroPOP] Notification preference update failed.", {
      code: error.code,
    });
    return apiFailure("INTERNAL_ERROR");
  }

  return apiSuccess({
    paceRemindersEnabled: parsed.data.paceRemindersEnabled,
  });
}

import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import { notificationPreferenceInputSchema } from "@/lib/contracts/push-notifications";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createPushServerClient } from "@/lib/infrastructure/supabase/push-server";
import { safeDatabaseDiagnostic } from "@/lib/infrastructure/supabase/safe-database-diagnostic";

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
  ).rpc("set_hydration_notification_preferences", {
    p_pace_reminders_enabled: parsed.data.paceRemindersEnabled,
  });

  if (error) {
    console.error(
      "[HydroPOP] Notification preference update failed.",
      safeDatabaseDiagnostic("set_hydration_notification_preferences", error),
    );
    return apiFailure("INTERNAL_ERROR");
  }

  return apiSuccess({
    paceRemindersEnabled: parsed.data.paceRemindersEnabled,
  });
}

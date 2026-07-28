import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { getTodayDashboard } from "@/lib/application/hydration/get-today-dashboard";
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
      await getTodayDashboard(
        await createClient(),
        authentication.user.id,
        new Date(),
      ),
    );
  } catch {
    console.error("[HydroPOP] Today dashboard request failed safely.");
    return apiFailure("INTERNAL_ERROR");
  }
}

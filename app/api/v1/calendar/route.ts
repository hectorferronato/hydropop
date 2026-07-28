import { z } from "zod";

import { getCalendarSummary } from "@/lib/application/hydration/get-calendar-summary";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createClient } from "@/lib/infrastructure/supabase/server";

const monthSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u, "Use YYYY-MM.");

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const parsedMonth = monthSchema.safeParse(
    new URL(request.url).searchParams.get("month"),
  );

  if (!parsedMonth.success) {
    return apiFailure("INVALID_INPUT");
  }

  try {
    return apiSuccess(
      await getCalendarSummary(
        await createClient(),
        authentication.user.id,
        parsedMonth.data,
      ),
    );
  } catch {
    console.error("[HydroPOP] Calendar request failed safely.");
    return apiFailure("INTERNAL_ERROR");
  }
}

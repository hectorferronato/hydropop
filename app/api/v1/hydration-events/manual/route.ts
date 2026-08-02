import { getTodayDashboard } from "@/lib/application/hydration/get-today-dashboard";
import { recordManualHydration } from "@/lib/application/hydration/record-manual-hydration";
import { revalidateHydrationViews } from "@/lib/application/hydration/revalidate-hydration-views";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { HydrationApplicationError } from "@/lib/contracts/api-response";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createHydrationRpcClient } from "@/lib/infrastructure/supabase/hydration-rpc";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { createClient } from "@/lib/infrastructure/supabase/server";

export async function POST(request: Request) {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return apiFailure("INVALID_INPUT");
  }

  try {
    const [rpcClient, queryClient] = await Promise.all([
      createHydrationRpcClient(),
      createClient(),
    ]);
    const result = await recordManualHydration({
      executeAtomicEvent: async (arguments_) =>
        await rpcClient.rpc("process_hydration_event", arguments_),
      getHydrationSnapshot: async () =>
        await getHydrationSnapshot(queryClient, authentication.user.id),
      getUpdatedDashboard: async () =>
        await getTodayDashboard(
          queryClient,
          authentication.user.id,
          new Date(),
        ),
      input,
    });

    revalidateHydrationViews();
    return apiSuccess(result, result.isNew ? 201 : 200);
  } catch (error) {
    if (error instanceof HydrationApplicationError) {
      return apiFailure(
        error.code === "INTERNAL_ERROR" ? "HYDRATION_WRITE_FAILED" : error.code,
      );
    }

    console.error("[HydroPOP] Manual hydration request failed safely.");
    return apiFailure("HYDRATION_WRITE_FAILED");
  }
}

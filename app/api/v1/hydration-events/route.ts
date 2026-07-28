import { HydrationApplicationError } from "@/lib/contracts/api-response";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { getTodayDashboard } from "@/lib/application/hydration/get-today-dashboard";
import { processHydrationEvent } from "@/lib/application/hydration/process-hydration-event";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createHydrationRpcClient } from "@/lib/infrastructure/supabase/hydration-rpc";
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
    const result = await processHydrationEvent({
      executeAtomicEvent: async (arguments_) =>
        await rpcClient.rpc("process_hydration_event", arguments_),
      getUpdatedDashboard: async () =>
        await getTodayDashboard(
          queryClient,
          authentication.user.id,
          new Date(),
        ),
      input,
    });

    return apiSuccess(result, result.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof HydrationApplicationError) {
      return apiFailure(error.code);
    }

    console.error("[HydroPOP] Hydration event request failed safely.");
    return apiFailure("INTERNAL_ERROR");
  }
}

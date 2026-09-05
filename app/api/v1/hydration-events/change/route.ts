import { changeHydrationRecording } from "@/lib/application/hydration/change-hydration-recording";
import { revalidateHydrationViews } from "@/lib/application/hydration/revalidate-hydration-views";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { HydrationApplicationError } from "@/lib/contracts/api-response";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { createClient } from "@/lib/infrastructure/supabase/server";

export async function POST(request: Request) {
  const authentication = await getAllowedUser();
  if (authentication.status !== "allowed")
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return apiFailure("INVALID_INPUT");
  }
  try {
    const client = await createClient();
    const result = await changeHydrationRecording({
      input,
      snapshot: await getHydrationSnapshot(client, authentication.user.id),
      execute: async (args) =>
        await client.rpc("change_hydration_recording", args),
    });
    revalidateHydrationViews();
    return apiSuccess(result);
  } catch (error) {
    return apiFailure(
      error instanceof HydrationApplicationError
        ? error.code
        : "HYDRATION_WRITE_FAILED",
    );
  }
}

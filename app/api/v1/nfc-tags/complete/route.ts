import { getTodayDashboard } from "@/lib/application/hydration/get-today-dashboard";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { completeNfcBottle } from "@/lib/application/nfc/complete-nfc-bottle";
import { resolveNfcScan } from "@/lib/application/nfc/resolve-nfc-scan";
import {
  HydrationApplicationError,
  NfcApplicationError,
} from "@/lib/contracts/api-response";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createHydrationRpcClient } from "@/lib/infrastructure/supabase/hydration-rpc";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { createNfcScanDataSource } from "@/lib/infrastructure/supabase/nfc";
import { createNfcRpcClient } from "@/lib/infrastructure/supabase/nfc-rpc";
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
    const [queryClient, hydrationRpcClient, nfcRpcClient] = await Promise.all([
      createClient(),
      createHydrationRpcClient(),
      createNfcRpcClient(),
    ]);
    const dataSource = createNfcScanDataSource(queryClient);
    const result = await completeNfcBottle({
      executeAtomicEvent: async (arguments_) =>
        await hydrationRpcClient.rpc("process_hydration_event", arguments_),
      getHydrationSnapshot: async () =>
        await getHydrationSnapshot(queryClient, authentication.user.id),
      getUpdatedDashboard: async () =>
        await getTodayDashboard(
          queryClient,
          authentication.user.id,
          new Date(),
        ),
      input,
      markConfirmed: async (tagId, eventId) => {
        const { data, error } = await nfcRpcClient.rpc(
          "mark_nfc_tag_confirmed",
          {
            p_event_id: eventId,
            p_tag_id: tagId,
          },
        );

        if (error || !data) {
          console.error("[HydroPOP] NFC confirmation timestamp failed.", {
            code: error?.code ?? "EMPTY_RESULT",
          });
          throw new NfcApplicationError("INTERNAL_ERROR");
        }

        return data;
      },
      resolveToken: async (token) =>
        await resolveNfcScan(dataSource, authentication.user.id, token),
    });

    return apiSuccess(result, result.duplicate ? 200 : 201);
  } catch (error) {
    if (
      error instanceof HydrationApplicationError ||
      error instanceof NfcApplicationError
    ) {
      return apiFailure(error.code);
    }

    console.error("[HydroPOP] NFC completion failed safely.");
    return apiFailure("INTERNAL_ERROR");
  }
}

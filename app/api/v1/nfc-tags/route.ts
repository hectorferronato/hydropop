import { issueNfcCredential } from "@/lib/application/nfc/issue-nfc-credential";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { createNfcTagInputSchema } from "@/lib/contracts/nfc";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  getNfcTagList,
  getOwnedActiveBottle,
  toNfcTagSummary,
} from "@/lib/infrastructure/supabase/nfc";
import { createNfcRpcClient } from "@/lib/infrastructure/supabase/nfc-rpc";
import { getSiteUrl } from "@/lib/infrastructure/supabase/public-env";
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
      await getNfcTagList(await createClient(), authentication.user.id),
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiFailure("INVALID_INPUT");
  }

  const parsed = createNfcTagInputSchema.safeParse(body);

  if (!parsed.success) {
    return apiFailure("INVALID_INPUT");
  }

  try {
    const queryClient = await createClient();
    const bottle = await getOwnedActiveBottle(
      queryClient,
      authentication.user.id,
      parsed.data.bottleId,
    );

    if (!bottle) {
      return apiFailure("BOTTLE_NOT_FOUND");
    }

    const rpcClient = await createNfcRpcClient();
    const issued = await issueNfcCredential({
      mutate: async (tokenHash) =>
        await rpcClient.rpc("create_nfc_tag", {
          p_bottle_id: parsed.data.bottleId,
          ...(parsed.data.label ? { p_label: parsed.data.label } : {}),
          p_token_hash: tokenHash,
        }),
      siteUrl: getSiteUrl(),
    });

    return apiSuccess(
      {
        nfcUrl: issued.nfcUrl,
        rawToken: issued.rawToken,
        tag: toNfcTagSummary(issued.data, bottle),
      },
      201,
    );
  } catch (error) {
    console.error("[HydroPOP] NFC tag creation failed.", {
      code:
        error instanceof Error && "code" in error
          ? String(error.code)
          : "UNKNOWN",
    });
    return apiFailure("INTERNAL_ERROR");
  }
}

import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { issueNfcCredential } from "@/lib/application/nfc/issue-nfc-credential";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  getNfcTagList,
  getOwnedNfcTag,
} from "@/lib/infrastructure/supabase/nfc";
import { createNfcRpcClient } from "@/lib/infrastructure/supabase/nfc-rpc";
import { getSiteUrl } from "@/lib/infrastructure/supabase/public-env";
import { createClient } from "@/lib/infrastructure/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const { id } = await context.params;

  try {
    const queryClient = await createClient();
    const existing = await getOwnedNfcTag(
      queryClient,
      authentication.user.id,
      id,
    );

    if (!existing) {
      return apiFailure("NFC_TAG_NOT_FOUND");
    }

    if (existing.status !== "active") {
      return apiFailure("NFC_TAG_REVOKED");
    }

    const rpcClient = await createNfcRpcClient();
    const issued = await issueNfcCredential({
      mutate: async (tokenHash) =>
        await rpcClient.rpc("rotate_nfc_tag", {
          p_tag_id: id,
          p_token_hash: tokenHash,
        }),
      siteUrl: getSiteUrl(),
    });
    const list = await getNfcTagList(queryClient, authentication.user.id);
    const tag = list.tags.find((item) => item.id === issued.data.id);

    if (!tag) {
      return apiFailure("INTERNAL_ERROR");
    }

    return apiSuccess({
      nfcUrl: issued.nfcUrl,
      rawToken: issued.rawToken,
      tag,
    });
  } catch (error) {
    console.error("[HydroPOP] NFC token rotation failed.", {
      code:
        error instanceof Error && "code" in error
          ? String(error.code)
          : "UNKNOWN",
    });
    return apiFailure("INTERNAL_ERROR");
  }
}

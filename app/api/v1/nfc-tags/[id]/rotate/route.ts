import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { issueNfcCredential } from "@/lib/application/nfc/issue-nfc-credential";
import {
  buildNfcUrl,
  getCanonicalSiteUrl,
} from "@/lib/application/urls/site-url";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  getNfcTagList,
  getOwnedNfcTag,
} from "@/lib/infrastructure/supabase/nfc";
import { createNfcClient } from "@/lib/infrastructure/supabase/nfc-rpc";

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
    const queryClient = await createNfcClient();
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

    const siteUrl = getCanonicalSiteUrl();
    const issued = await issueNfcCredential({
      mutate: async (tokenHash) =>
        await queryClient.rpc("rotate_nfc_tag", {
          p_tag_id: id,
          p_token_hash: tokenHash,
        }),
      siteUrl,
    });
    const list = await getNfcTagList(queryClient, authentication.user.id);
    const tag = list.tags.find((item) => item.id === issued.data.id);

    if (!tag) {
      return apiFailure("INTERNAL_ERROR");
    }

    return apiSuccess({
      friendlyUrl: tag.friendlyCode
        ? buildNfcUrl(siteUrl, tag.friendlyCode)
        : null,
      rawToken: issued.rawToken,
      secureUrl: issued.secureUrl,
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

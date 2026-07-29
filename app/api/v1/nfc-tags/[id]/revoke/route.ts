import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
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

    const { data, error } = await queryClient.rpc("revoke_nfc_tag", {
      p_tag_id: id,
    });

    if (error || !data) {
      console.error("[HydroPOP] NFC tag revocation RPC failed.", {
        code: error?.code ?? "EMPTY_RESULT",
      });
      return apiFailure("INTERNAL_ERROR");
    }

    const list = await getNfcTagList(queryClient, authentication.user.id);
    const tag = list.tags.find((item) => item.id === data.id);

    return tag ? apiSuccess(tag) : apiFailure("INTERNAL_ERROR");
  } catch {
    return apiFailure("INTERNAL_ERROR");
  }
}

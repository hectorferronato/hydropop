import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { updateNfcTagInputSchema } from "@/lib/contracts/nfc";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  getNfcTagList,
  getOwnedActiveBottle,
  getOwnedNfcTag,
} from "@/lib/infrastructure/supabase/nfc";
import { createNfcClient } from "@/lib/infrastructure/supabase/nfc-rpc";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const parsed = updateNfcTagInputSchema.safeParse(body);

  if (!parsed.success) {
    return apiFailure("INVALID_INPUT");
  }

  const { id } = await context.params;

  try {
    const queryClient = await createNfcClient();
    const [tag, bottle] = await Promise.all([
      getOwnedNfcTag(queryClient, authentication.user.id, id),
      getOwnedActiveBottle(
        queryClient,
        authentication.user.id,
        parsed.data.bottleId,
      ),
    ]);

    if (!tag) {
      return apiFailure("NFC_TAG_NOT_FOUND");
    }

    if (tag.status !== "active") {
      return apiFailure("NFC_TAG_REVOKED");
    }

    if (!bottle) {
      return apiFailure("BOTTLE_NOT_FOUND");
    }

    const { data, error } = await queryClient.rpc("update_nfc_tag", {
      p_bottle_id: parsed.data.bottleId,
      p_friendly_code: parsed.data.friendlyCode ?? "",
      p_label: parsed.data.label ?? "",
      p_tag_id: id,
    });

    if (error?.code === "P0001") {
      return apiFailure("NFC_CODE_UNAVAILABLE");
    }

    if (error || !data) {
      console.error("[HydroPOP] NFC tag update RPC failed.", {
        code: error?.code ?? "EMPTY_RESULT",
      });
      return apiFailure("INTERNAL_ERROR");
    }

    const list = await getNfcTagList(queryClient, authentication.user.id);
    const updated = list.tags.find((item) => item.id === data.id);

    return updated ? apiSuccess(updated) : apiFailure("INTERNAL_ERROR");
  } catch {
    return apiFailure("INTERNAL_ERROR");
  }
}

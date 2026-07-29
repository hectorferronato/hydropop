import {
  issueNfcCredential,
  NfcCredentialIssueError,
} from "@/lib/application/nfc/issue-nfc-credential";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import {
  buildNfcUrl,
  getCanonicalSiteUrl,
} from "@/lib/application/urls/site-url";
import { createNfcTagInputSchema } from "@/lib/contracts/nfc";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  getNfcTagList,
  getOwnedActiveBottle,
  toNfcTagSummary,
} from "@/lib/infrastructure/supabase/nfc";
import { createNfcClient } from "@/lib/infrastructure/supabase/nfc-rpc";

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
      await getNfcTagList(await createNfcClient(), authentication.user.id),
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
    const queryClient = await createNfcClient();
    const bottle = await getOwnedActiveBottle(
      queryClient,
      authentication.user.id,
      parsed.data.bottleId,
    );

    if (!bottle) {
      return apiFailure("BOTTLE_NOT_FOUND");
    }

    const rpcClient = queryClient;
    const siteUrl = getCanonicalSiteUrl();
    const issued = await issueNfcCredential({
      mutate: async (tokenHash) =>
        await rpcClient.rpc("create_nfc_tag", {
          p_bottle_id: parsed.data.bottleId,
          ...(parsed.data.friendlyCode
            ? { p_friendly_code: parsed.data.friendlyCode }
            : {}),
          ...(parsed.data.label ? { p_label: parsed.data.label } : {}),
          p_token_hash: tokenHash,
        }),
      siteUrl,
    });
    const tag = toNfcTagSummary(issued.data, bottle);

    return apiSuccess(
      {
        friendlyUrl: tag.friendlyCode
          ? buildNfcUrl(siteUrl, tag.friendlyCode)
          : null,
        rawToken: issued.rawToken,
        secureUrl: issued.secureUrl,
        tag,
      },
      201,
    );
  } catch (error) {
    if (error instanceof NfcCredentialIssueError && error.code === "P0001") {
      return apiFailure("NFC_CODE_UNAVAILABLE");
    }

    console.error("[HydroPOP] NFC tag creation failed.", {
      code:
        error instanceof Error && "code" in error
          ? String(error.code)
          : "UNKNOWN",
    });
    return apiFailure("INTERNAL_ERROR");
  }
}

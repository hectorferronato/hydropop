import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import {
  issueNfcCredential,
  NfcCredentialIssueError,
} from "@/lib/application/nfc/issue-nfc-credential";
import { getCanonicalSiteUrl } from "@/lib/application/urls/site-url";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createOnboardingRpcClient } from "@/lib/infrastructure/supabase/onboarding-rpc";

export const dynamic = "force-dynamic";

export async function POST() {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  try {
    const supabase = await createOnboardingRpcClient();
    await issueNfcCredential({
      mutate: async (tokenHash) =>
        await supabase.rpc("activate_pilot_nfc_tag", {
          p_token_hash: tokenHash,
        }),
      siteUrl: getCanonicalSiteUrl(),
    });

    return apiSuccess({ activated: true });
  } catch (error) {
    if (error instanceof NfcCredentialIssueError) {
      if (error.code === "P0002") {
        return apiFailure("PRIMARY_BOTTLE_REQUIRED");
      }

      if (error.code === "P0001") {
        return apiFailure("PILOT_TAG_CONFLICT");
      }
    }

    console.error("[HydroPOP] Pilot NFC activation failed safely.", {
      code: error instanceof NfcCredentialIssueError ? error.code : "UNKNOWN",
    });
    return apiFailure("PILOT_TAG_UNAVAILABLE");
  }
}

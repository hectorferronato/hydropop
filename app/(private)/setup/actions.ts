"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createSetupPath,
  isPilotNfcDestination,
  sanitizeLoginDestination,
} from "@/lib/application/auth/login-destination";
import { revalidateHydrationViews } from "@/lib/application/hydration/revalidate-hydration-views";
import {
  issueNfcCredential,
  NfcCredentialIssueError,
} from "@/lib/application/nfc/issue-nfc-credential";
import { toSaveOnboardingArguments } from "@/lib/application/onboarding/save-onboarding";
import { getCanonicalSiteUrl } from "@/lib/application/urls/site-url";
import { parseSetupFormData } from "@/lib/contracts/setup";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createOnboardingRpcClient } from "@/lib/infrastructure/supabase/onboarding-rpc";

import type { SetupState } from "./state";

const genericSetupError =
  "We couldn’t save your setup. Your existing settings are unchanged. Please try again.";

function getPostSetupDestination(value: FormDataEntryValue | null): Route {
  const destination = sanitizeLoginDestination(
    typeof value === "string" ? value : null,
  );

  return destination.startsWith("/setup") ? ("/today" as Route) : destination;
}

export async function saveSetup(
  _previousState: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const destination = getPostSetupDestination(formData.get("next"));
  const setupPath = isPilotNfcDestination(destination)
    ? createSetupPath(destination, { completePartialSetup: true })
    : ((destination === "/settings"
        ? "/setup?mode=complete"
        : "/setup") as Route);
  await requireAllowedUser(setupPath);

  const parsed = parseSetupFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      message: "Review the highlighted fields and try again.",
    };
  }

  try {
    const supabase = await createOnboardingRpcClient();
    const isPilotSetup = isPilotNfcDestination(destination);

    if (isPilotSetup) {
      await issueNfcCredential({
        mutate: async (pilotTokenHash) =>
          await supabase.rpc(
            "save_onboarding",
            toSaveOnboardingArguments(parsed.data, { pilotTokenHash }),
          ),
        siteUrl: getCanonicalSiteUrl(),
      });
    } else {
      const { error } = await supabase.rpc(
        "save_onboarding",
        toSaveOnboardingArguments(parsed.data),
      );

      if (error) {
        return { message: genericSetupError };
      }
    }

    // The raw pilot credential is intentionally discarded; /t/pilot is canonical.
  } catch (error) {
    if (error instanceof NfcCredentialIssueError && error.code === "P0001") {
      return {
        message:
          "Your setup remains unchanged because this account’s pilot tag cannot be reactivated automatically. Contact the pilot administrator.",
      };
    }

    return { message: genericSetupError };
  }

  revalidatePath("/setup");
  revalidatePath("/settings");
  revalidateHydrationViews();
  redirect(destination);
}

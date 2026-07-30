"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sanitizeLoginDestination } from "@/lib/application/auth/login-destination";
import { revalidateHydrationViews } from "@/lib/application/hydration/revalidate-hydration-views";
import { toSaveOnboardingArguments } from "@/lib/application/onboarding/save-onboarding";
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
  const setupPath = (
    destination === "/settings" ? "/setup?mode=complete" : "/setup"
  ) as Route;
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
    const { error } = await supabase.rpc(
      "save_onboarding",
      toSaveOnboardingArguments(parsed.data),
    );

    if (error) {
      return { message: genericSetupError };
    }
  } catch {
    return { message: genericSetupError };
  }

  revalidatePath("/setup");
  revalidatePath("/settings");
  revalidateHydrationViews();
  redirect(destination);
}

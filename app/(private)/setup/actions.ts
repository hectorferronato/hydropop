"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sanitizeLoginDestination } from "@/lib/application/auth/login-destination";
import { toSaveOnboardingArguments } from "@/lib/application/onboarding/save-onboarding";
import { parseSetupFormData } from "@/lib/contracts/setup";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createClient } from "@/lib/infrastructure/supabase/server";

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
  const setupPath =
    `/setup?${new URLSearchParams({ next: destination })}` as Route;
  await requireAllowedUser(setupPath);

  const parsed = parseSetupFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      message: "Review the highlighted fields and try again.",
    };
  }

  try {
    const supabase = await createClient();
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

  revalidatePath("/", "layout");
  redirect(destination);
}

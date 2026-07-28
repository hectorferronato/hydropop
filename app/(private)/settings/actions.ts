"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toSaveOnboardingArguments } from "@/lib/application/onboarding/save-onboarding";
import {
  applyBottleSettings,
  applyHydrationSettings,
  applyProfileSettings,
  toCurrentSetupInput,
} from "@/lib/application/settings/update-settings";
import {
  parseBottleSettingsFormData,
  parseHydrationSettingsFormData,
  parseProfileSettingsFormData,
  type SetupInput,
} from "@/lib/contracts/setup";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createOnboardingRpcClient } from "@/lib/infrastructure/supabase/onboarding-rpc";
import { createClient } from "@/lib/infrastructure/supabase/server";

import type { SettingsActionState } from "./state";

const genericSettingsError =
  "We couldn’t save this change. Your existing settings are unchanged.";

async function requireCurrentSettingsInput(
  returnTo: Route,
): Promise<SetupInput> {
  const user = await requireAllowedUser(returnTo);
  const supabase = await createClient();
  const snapshot = await getOnboardingSnapshot(supabase, user.id);
  const current = toCurrentSetupInput(snapshot);

  if (!current) {
    redirect("/setup?mode=complete");
  }

  return current;
}

async function persistSettings(input: SetupInput): Promise<boolean> {
  try {
    const supabase = await createOnboardingRpcClient();
    const { error } = await supabase.rpc(
      "save_onboarding",
      toSaveOnboardingArguments(input),
    );

    if (error) {
      console.error("[HydroPOP] Settings persistence failed.", {
        code: error.code,
      });
      return false;
    }

    return true;
  } catch {
    console.error("[HydroPOP] Settings persistence failed before RPC.");
    return false;
  }
}

function revalidateSettingsViews(): void {
  revalidatePath("/settings");
  revalidatePath("/setup");
  revalidatePath("/today");
}

export async function saveProfileSettings(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const current = await requireCurrentSettingsInput("/settings/profile");
  const parsed = parseProfileSettingsFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      message: "Review the highlighted fields and try again.",
    };
  }

  if (!(await persistSettings(applyProfileSettings(current, parsed.data)))) {
    return { message: genericSettingsError };
  }

  revalidateSettingsViews();
  redirect("/settings?updated=profile");
}

export async function saveHydrationSettings(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const current = await requireCurrentSettingsInput("/settings/hydration");
  const parsed = parseHydrationSettingsFormData(
    formData,
    current.preferredUnit,
  );

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      message: "Review the highlighted fields and try again.",
    };
  }

  if (!(await persistSettings(applyHydrationSettings(current, parsed.data)))) {
    return { message: genericSettingsError };
  }

  revalidateSettingsViews();
  redirect("/settings?updated=hydration");
}

export async function saveBottleSettings(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const current = await requireCurrentSettingsInput("/settings/bottle");
  const parsed = parseBottleSettingsFormData(formData, current.preferredUnit);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      message: "Review the highlighted fields and try again.",
    };
  }

  if (!(await persistSettings(applyBottleSettings(current, parsed.data)))) {
    return { message: genericSettingsError };
  }

  revalidateSettingsViews();
  redirect("/settings?updated=bottle");
}

export async function archivePrimaryBottle(): Promise<void> {
  const user = await requireAllowedUser("/settings");
  const supabase = await createClient();
  const snapshot = await getOnboardingSnapshot(supabase, user.id);

  if (!snapshot.bottle) {
    redirect("/settings?error=no-primary-bottle");
  }

  const { data, error } = await supabase
    .from("bottles")
    .update({
      archived_at: new Date().toISOString(),
      is_primary: false,
    })
    .eq("id", snapshot.bottle.id)
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[HydroPOP] Primary bottle archive failed.", {
      code: error?.code ?? "NO_MATCHING_BOTTLE",
    });
    redirect("/settings?error=archive-failed");
  }

  revalidateSettingsViews();
  redirect("/settings?updated=bottle-archived");
}

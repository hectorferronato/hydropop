import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import { toSetupFormValues } from "@/lib/application/onboarding/setup-form-values";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";

import { HydrationForm } from "./hydration-form";

export default async function HydrationSettingsPage() {
  await connection();

  const user = await requireAllowedUser("/settings/hydration");
  const supabase = await createClient();
  const snapshot = await getOnboardingSnapshot(supabase, user.id);

  if (!snapshot.isComplete) {
    redirect("/setup?mode=complete");
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings · Hydration plan"
        title="Edit hydration plan"
        description="Set the active daily target without rewriting previous hydration-goal periods."
      />
      <HydrationForm initialValues={toSetupFormValues(snapshot, user.email)} />
    </>
  );
}

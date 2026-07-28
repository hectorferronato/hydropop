import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import { toSetupFormValues } from "@/lib/application/onboarding/setup-form-values";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";

import { BottleForm } from "./bottle-form";

export default async function BottleSettingsPage() {
  await connection();

  const user = await requireAllowedUser("/settings/bottle");
  const supabase = await createClient();
  const snapshot = await getOnboardingSnapshot(supabase, user.id);

  if (!snapshot.isComplete) {
    redirect("/setup?mode=complete");
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings · Primary bottle"
        title="Edit primary bottle"
        description="Update the active bottle while preserving its identity and hydration history."
      />
      <BottleForm initialValues={toSetupFormValues(snapshot, user.email)} />
    </>
  );
}

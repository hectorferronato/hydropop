import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import { toSetupFormValues } from "@/lib/application/onboarding/setup-form-values";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";

import { ProfileForm } from "./profile-form";

export default async function ProfileSettingsPage() {
  await connection();

  const user = await requireAllowedUser("/settings/profile");
  const supabase = await createClient();
  const snapshot = await getOnboardingSnapshot(supabase, user.id);

  if (!snapshot.isComplete) {
    redirect("/setup?mode=complete");
  }

  const initialValues = toSetupFormValues(snapshot, user.email);
  const supportedTimezones = Intl.supportedValuesOf("timeZone");
  const timezones = supportedTimezones.includes(initialValues.timezone)
    ? supportedTimezones
    : [initialValues.timezone, ...supportedTimezones];

  return (
    <>
      <PageHeader
        eyebrow="Settings · Profile"
        title="Edit profile"
        description="Update your name, timezone, preferred display unit, and hydration-day schedule."
      />
      <ProfileForm initialValues={initialValues} timezones={timezones} />
    </>
  );
}

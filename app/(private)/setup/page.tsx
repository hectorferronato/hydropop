import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import {
  getFirstIncompleteSetupStep,
  getSetupPageDisposition,
} from "@/lib/application/onboarding/onboarding-status";
import { toSetupFormValues } from "@/lib/application/onboarding/setup-form-values";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";

import { SetupForm } from "./setup-form";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  await connection();

  const parameters = await searchParams;
  const requestedMode = Array.isArray(parameters.mode)
    ? parameters.mode[0]
    : parameters.mode;
  const setupPath =
    requestedMode === "complete" ? "/setup?mode=complete" : "/setup";
  const user = await requireAllowedUser(setupPath);
  const supabase = await createClient();
  const snapshot = await getOnboardingSnapshot(supabase, user.id);

  if (
    getSetupPageDisposition(snapshot.status, requestedMode) ===
    "redirectToSettings"
  ) {
    redirect("/settings");
  }

  const destination = snapshot.status.hasStartedConfiguration
    ? "/settings"
    : "/today";
  const initialValues = toSetupFormValues(snapshot, user.email);
  const supportedTimezones = Intl.supportedValuesOf("timeZone");
  const timezones = supportedTimezones.includes(initialValues.timezone)
    ? supportedTimezones
    : [initialValues.timezone, ...supportedTimezones];

  return (
    <>
      <PageHeader
        eyebrow={
          snapshot.status.hasStartedConfiguration
            ? "Complete your setup"
            : "Welcome to HydroPOP"
        }
        title="Set up your hydration day"
        description="Tell HydroPOP about your schedule, daily target, and primary bottle. Once complete, you’ll manage these details from Settings."
      />
      <SetupForm
        destination={destination}
        initialStep={getFirstIncompleteSetupStep(snapshot.status.missing)}
        initialValues={initialValues}
        timezones={timezones}
      />
    </>
  );
}

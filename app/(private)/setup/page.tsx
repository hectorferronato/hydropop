import { PageHeader } from "@/components/page-header";
import { sanitizeLoginDestination } from "@/lib/application/auth/login-destination";
import type { SetupFormValues } from "@/lib/contracts/setup";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { formatDisplayVolume } from "@/lib/units/volume";

import { SetupForm } from "./setup-form";

function trimDatabaseTime(value: string | null | undefined, fallback: string) {
  return value ? value.slice(0, 5) : fallback;
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const parameters = await searchParams;
  const requestedDestination = Array.isArray(parameters.next)
    ? parameters.next[0]
    : parameters.next;
  const sanitizedDestination = sanitizeLoginDestination(requestedDestination);
  const destination = sanitizedDestination.startsWith("/setup")
    ? "/today"
    : sanitizedDestination;
  const setupPath = `/setup?${new URLSearchParams({ next: destination })}`;
  const user = await requireAllowedUser(setupPath);
  const supabase = await createClient();
  const snapshot = await getOnboardingSnapshot(supabase, user.id);
  const unit = snapshot.profile?.preferred_unit ?? "oz";
  const displayName =
    snapshot.profile?.display_name?.trim() ||
    user.email.split("@")[0] ||
    "HydroPOP friend";
  const initialValues: SetupFormValues = {
    bottleBrand: snapshot.bottle?.brand ?? "",
    bottleCapacity: formatDisplayVolume(
      snapshot.bottle?.capacity_ml ?? 710,
      unit,
    ),
    bottleId: snapshot.bottle?.id ?? "",
    bottleIsPrimary: snapshot.bottle?.is_primary ?? true,
    bottleModel: snapshot.bottle?.model ?? "",
    bottleName: snapshot.bottle?.name ?? "Everyday bottle",
    dailyGoal: formatDisplayVolume(snapshot.goal?.daily_goal_ml ?? 2130, unit),
    displayName,
    preferredUnit: unit,
    targetCompletionTime: trimDatabaseTime(
      snapshot.profile?.target_completion_time ??
        snapshot.goal?.target_completion_time,
      "20:00",
    ),
    timezone: snapshot.profile?.timezone ?? "America/New_York",
    wakeTime: trimDatabaseTime(snapshot.profile?.wake_time, "07:00"),
  };
  const supportedTimezones = Intl.supportedValuesOf("timeZone");
  const timezones = supportedTimezones.includes(initialValues.timezone)
    ? supportedTimezones
    : [initialValues.timezone, ...supportedTimezones];

  return (
    <>
      <PageHeader
        eyebrow={snapshot.isComplete ? "Preferences" : "Welcome to HydroPOP"}
        title={snapshot.isComplete ? "Hydration settings" : "Set up your day"}
        description="Tell HydroPOP about your schedule, daily target, and primary bottle. You can return here whenever your routine changes."
      />
      <SetupForm
        destination={destination}
        initialValues={initialValues}
        timezones={timezones}
      />
    </>
  );
}

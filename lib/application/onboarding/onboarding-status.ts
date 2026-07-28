import { isValidIanaTimezone } from "@/lib/domain/hydration/hydration-day";
import { isVolumeUnit } from "@/lib/units/volume";

type OnboardingStatusSnapshot = {
  bottle: { is_primary: boolean } | null;
  goal: object | null;
  profile: {
    display_name: string | null;
    preferred_unit: unknown;
    target_completion_time: string | null;
    timezone: string;
    wake_time: string | null;
  } | null;
};

export type MissingConfiguration =
  "activeGoal" | "completedProfile" | "primaryBottle";

export type OnboardingStatus = {
  hasActiveGoal: boolean;
  hasActivePrimaryBottle: boolean;
  hasCompletedProfile: boolean;
  hasStartedConfiguration: boolean;
  isComplete: boolean;
  missing: readonly MissingConfiguration[];
};

export function getOnboardingStatus(
  snapshot: OnboardingStatusSnapshot,
): OnboardingStatus {
  const hasCompletedProfile = Boolean(
    snapshot.profile?.display_name?.trim() &&
    snapshot.profile.wake_time &&
    snapshot.profile.target_completion_time &&
    isValidIanaTimezone(snapshot.profile.timezone) &&
    isVolumeUnit(snapshot.profile.preferred_unit),
  );
  const hasActiveGoal = snapshot.goal !== null;
  const hasActivePrimaryBottle = Boolean(snapshot.bottle?.is_primary);
  const missing: MissingConfiguration[] = [];

  if (!hasCompletedProfile) {
    missing.push("completedProfile");
  }

  if (!hasActiveGoal) {
    missing.push("activeGoal");
  }

  if (!hasActivePrimaryBottle) {
    missing.push("primaryBottle");
  }

  const hasStartedConfiguration = Boolean(
    snapshot.profile?.display_name?.trim() ||
    snapshot.profile?.wake_time ||
    snapshot.profile?.target_completion_time ||
    hasActiveGoal ||
    snapshot.bottle,
  );

  return {
    hasActiveGoal,
    hasActivePrimaryBottle,
    hasCompletedProfile,
    hasStartedConfiguration,
    isComplete: missing.length === 0,
    missing,
  };
}

export function getSetupPageDisposition(
  status: Pick<OnboardingStatus, "hasStartedConfiguration" | "isComplete">,
  requestedMode: string | null | undefined,
): "redirectToSettings" | "showOnboarding" {
  if (status.isComplete) {
    return "redirectToSettings";
  }

  if (status.hasStartedConfiguration && requestedMode !== "complete") {
    return "redirectToSettings";
  }

  return "showOnboarding";
}

export function getFirstIncompleteSetupStep(
  missing: readonly MissingConfiguration[],
): 0 | 2 | 3 {
  if (missing.includes("completedProfile")) {
    return 0;
  }

  if (missing.includes("activeGoal")) {
    return 2;
  }

  return 3;
}

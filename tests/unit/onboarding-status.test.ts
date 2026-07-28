import { describe, expect, it } from "vitest";

import {
  getFirstIncompleteSetupStep,
  getOnboardingStatus,
  getSetupPageDisposition,
} from "@/lib/application/onboarding/onboarding-status";

const completedProfile = {
  display_name: "Beatriz",
  preferred_unit: "oz",
  target_completion_time: "20:00:00",
  timezone: "America/New_York",
  wake_time: "07:00:00",
};

describe("onboarding status", () => {
  it("shows onboarding for a genuinely new user", () => {
    const status = getOnboardingStatus({
      bottle: null,
      goal: null,
      profile: {
        display_name: null,
        preferred_unit: "oz",
        target_completion_time: null,
        timezone: "America/New_York",
        wake_time: null,
      },
    });

    expect(status).toMatchObject({
      hasStartedConfiguration: false,
      isComplete: false,
    });
    expect(getSetupPageDisposition(status, null)).toBe("showOnboarding");
  });

  it("redirects a completed user from setup to settings", () => {
    const status = getOnboardingStatus({
      bottle: { is_primary: true },
      goal: {},
      profile: completedProfile,
    });

    expect(status.isComplete).toBe(true);
    expect(getSetupPageDisposition(status, null)).toBe("redirectToSettings");
    expect(getSetupPageDisposition(status, "complete")).toBe(
      "redirectToSettings",
    );
  });

  it("requires an explicit completion action for partial configuration", () => {
    const status = getOnboardingStatus({
      bottle: null,
      goal: {},
      profile: completedProfile,
    });

    expect(status.isComplete).toBe(false);
    expect(status.hasStartedConfiguration).toBe(true);
    expect(status.missing).toEqual(["primaryBottle"]);
    expect(getFirstIncompleteSetupStep(status.missing)).toBe(3);
    expect(getSetupPageDisposition(status, null)).toBe("redirectToSettings");
    expect(getSetupPageDisposition(status, "complete")).toBe("showOnboarding");
  });
});

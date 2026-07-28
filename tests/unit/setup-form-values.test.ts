import { describe, expect, it } from "vitest";

import {
  getSetupFormRevision,
  toSetupFormValues,
} from "@/lib/application/onboarding/setup-form-values";

const persistedSnapshot = {
  bottle: {
    brand: "Owala",
    capacity_ml: 710,
    id: "3a8d1d53-f6ab-4cc7-86f1-5a78382e3680",
    is_primary: true,
    model: "FreeSip",
    name: "Work bottle",
  },
  goal: {
    daily_goal_ml: 2130,
    target_completion_time: "19:45:00",
  },
  profile: {
    display_name: "Beatriz",
    preferred_unit: "oz",
    target_completion_time: "20:15:00",
    timezone: "America/New_York",
    wake_time: "06:30:00",
  },
};

describe("setup form values", () => {
  it("reloads the saved profile fields", () => {
    const values = toSetupFormValues(persistedSnapshot, "beatriz@example.com");

    expect(values).toMatchObject({
      displayName: "Beatriz",
      preferredUnit: "oz",
      targetCompletionTime: "20:15",
      timezone: "America/New_York",
      wakeTime: "06:30",
    });
  });

  it("reloads the saved primary bottle and preserves its ID", () => {
    const values = toSetupFormValues(persistedSnapshot, "beatriz@example.com");

    expect(values).toMatchObject({
      bottleBrand: "Owala",
      bottleCapacity: "24",
      bottleId: "3a8d1d53-f6ab-4cc7-86f1-5a78382e3680",
      bottleIsPrimary: true,
      bottleModel: "FreeSip",
      bottleName: "Work bottle",
    });
  });

  it("reloads the saved active goal", () => {
    const values = toSetupFormValues(persistedSnapshot, "beatriz@example.com");

    expect(values.dailyGoal).toBe("72");
  });

  it("converts stored milliliters to ounces for display", () => {
    const values = toSetupFormValues(
      {
        ...persistedSnapshot,
        bottle: { ...persistedSnapshot.bottle, capacity_ml: 1000 },
        goal: { ...persistedSnapshot.goal, daily_goal_ml: 2500 },
      },
      "beatriz@example.com",
    );

    expect(values.bottleCapacity).toBe("33.8");
    expect(values.dailyGoal).toBe("84.5");
  });

  it("keeps stored milliliters unchanged for ml display", () => {
    const values = toSetupFormValues(
      {
        ...persistedSnapshot,
        profile: { ...persistedSnapshot.profile, preferred_unit: "ml" },
      },
      "beatriz@example.com",
    );

    expect(values.bottleCapacity).toBe("710");
    expect(values.dailyGoal).toBe("2130");
  });

  it("changes the form revision when refreshed server values change", () => {
    const initialValues = toSetupFormValues(
      { bottle: null, goal: null, profile: null },
      "beatriz@example.com",
    );
    const persistedValues = toSetupFormValues(
      persistedSnapshot,
      "beatriz@example.com",
    );

    expect(getSetupFormRevision(persistedValues)).not.toBe(
      getSetupFormRevision(initialValues),
    );
    expect(getSetupFormRevision(persistedValues)).toBe(
      getSetupFormRevision({ ...persistedValues }),
    );
  });
});

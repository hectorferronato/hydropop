import { describe, expect, it } from "vitest";

import { toSettingsSummary } from "@/lib/application/settings/settings-summary";

const persistedSettings = {
  bottle: {
    brand: "Owala",
    capacity_ml: 710,
    id: "3a8d1d53-f6ab-4cc7-86f1-5a78382e3680",
    is_primary: true,
    model: "FreeSip",
    name: "Work bottle",
    typical_fill_ml: 650,
  },
  goal: {
    daily_goal_ml: 2130,
    effective_from: "2026-07-25",
    target_completion_time: "20:00:00",
  },
  profile: {
    display_name: "Beatriz",
    preferred_unit: "oz",
    target_completion_time: "20:00:00",
    timezone: "America/New_York",
    wake_time: "07:00:00",
  },
};

describe("settings summary", () => {
  it("shows the persisted profile summary", () => {
    const summary = toSettingsSummary(persistedSettings);

    expect(summary.profile).toEqual({
      displayName: "Beatriz",
      preferredUnit: "oz",
      targetCompletionTime: "20:00",
      timezone: "America/New_York",
      wakeTime: "07:00",
    });
  });

  it("shows the active hydration goal and effective date", () => {
    const summary = toSettingsSummary(persistedSettings);

    expect(summary.goal).toEqual({
      dailyGoal: "72 oz",
      effectiveDate: "Jul 25, 2026",
      targetCompletionTime: "20:00",
    });
  });

  it("shows the active primary bottle", () => {
    const summary = toSettingsSummary(persistedSettings);

    expect(summary.bottle).toEqual({
      brand: "Owala",
      capacity: "24 oz",
      id: "3a8d1d53-f6ab-4cc7-86f1-5a78382e3680",
      isPrimary: true,
      model: "FreeSip",
      name: "Work bottle",
      normalFill: "22 oz",
      typicalFill: "22 oz",
    });
  });

  it("uses milliliters when they are the preferred unit", () => {
    const summary = toSettingsSummary({
      ...persistedSettings,
      profile: { ...persistedSettings.profile, preferred_unit: "ml" },
    });

    expect(summary.goal?.dailyGoal).toBe("2130 ml");
    expect(summary.bottle?.capacity).toBe("710 ml");
    expect(summary.bottle?.normalFill).toBe("650 ml");
  });

  it("shows that full capacity is used when typical fill is blank", () => {
    const summary = toSettingsSummary({
      ...persistedSettings,
      bottle: { ...persistedSettings.bottle, typical_fill_ml: null },
    });

    expect(summary.bottle?.typicalFill).toBe("Not set — using full capacity");
    expect(summary.bottle?.normalFill).toBe("24 oz");
  });
});

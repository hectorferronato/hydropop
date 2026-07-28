import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
} from "@/lib/contracts/setup";

const settingsActions = readFileSync(
  resolve(process.cwd(), "app", "(private)", "settings", "actions.ts"),
  "utf8",
);
const appNavigation = readFileSync(
  resolve(process.cwd(), "components", "app-navigation.tsx"),
  "utf8",
);
const settingsPage = readFileSync(
  resolve(process.cwd(), "app", "(private)", "settings", "page.tsx"),
  "utf8",
);
const onboardingMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase",
    "migrations",
    "20260728131000_add_onboarding_typical_fill.sql",
  ),
  "utf8",
);

const currentSnapshot = {
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
  },
  profile: {
    display_name: "Beatriz",
    preferred_unit: "oz",
    target_completion_time: "20:00:00",
    timezone: "America/New_York",
    wake_time: "07:00:00",
  },
};

function requireCurrentInput() {
  const input = toCurrentSetupInput(currentSnapshot);

  if (!input) {
    throw new Error("Expected a complete current settings input");
  }

  return input;
}

describe("settings update integration", () => {
  it("persists validated profile edits through the existing RPC contract", () => {
    const formData = new FormData();
    formData.set("displayName", "Bea");
    formData.set("preferredUnit", "ml");
    formData.set("targetCompletionTime", "19:30");
    formData.set("timezone", "America/Los_Angeles");
    formData.set("wakeTime", "06:15");
    const parsed = parseProfileSettingsFormData(formData);

    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      throw new Error("Expected profile settings to validate");
    }

    const arguments_ = toSaveOnboardingArguments(
      applyProfileSettings(requireCurrentInput(), parsed.data),
    );

    expect(arguments_).toMatchObject({
      p_display_name: "Bea",
      p_preferred_unit: "ml",
      p_target_completion_time: "19:30",
      p_timezone: "America/Los_Angeles",
      p_wake_time: "06:15",
    });
    expect(arguments_).not.toHaveProperty("p_user_id");
  });

  it("updates the existing bottle instead of creating a duplicate", () => {
    const formData = new FormData();
    formData.set("bottleBrand", "Hydro Flask");
    formData.set("bottleCapacity", "32");
    formData.set("bottleModel", "Wide Mouth");
    formData.set("bottleName", "Gym bottle");
    formData.set("bottleTypicalFill", "30");
    const parsed = parseBottleSettingsFormData(formData, "oz");

    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      throw new Error("Expected bottle settings to validate");
    }

    const arguments_ = toSaveOnboardingArguments(
      applyBottleSettings(requireCurrentInput(), parsed.data),
    );

    expect(arguments_).toMatchObject({
      p_bottle_capacity_ml: 946,
      p_bottle_id: "3a8d1d53-f6ab-4cc7-86f1-5a78382e3680",
      p_bottle_name: "Gym bottle",
      p_bottle_typical_fill_ml: 887,
    });
  });

  it("changes the active goal through the date-effective RPC contract", () => {
    const formData = new FormData();
    formData.set("dailyGoal", "80");
    formData.set("targetCompletionTime", "19:45");
    const parsed = parseHydrationSettingsFormData(formData, "oz");

    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      throw new Error("Expected hydration settings to validate");
    }

    const arguments_ = toSaveOnboardingArguments(
      applyHydrationSettings(requireCurrentInput(), parsed.data),
    );

    expect(arguments_).toMatchObject({
      p_daily_goal_ml: 2366,
      p_target_completion_time: "19:45",
    });
    expect(onboardingMigration).toContain(
      "set effective_until = v_hydration_day - 1",
    );
    expect(onboardingMigration).toContain("insert into public.hydration_goals");
  });

  it("archives without deleting the bottle or hydration history", () => {
    expect(settingsActions).toContain('.from("bottles")');
    expect(settingsActions).toContain("archived_at: new Date().toISOString()");
    expect(settingsActions).toContain("is_primary: false");
    expect(settingsActions).not.toMatch(/\.delete\s*\(\s*\)/u);
    expect(settingsActions).not.toContain('from("hydration_events")');
  });

  it("points ordinary navigation to settings instead of setup", () => {
    expect(appNavigation).toContain(
      '{ href: "/settings", label: "Settings", icon: SettingsIcon }',
    );
    expect(appNavigation).not.toContain(
      '{ href: "/setup", label: "Settings", icon: SettingsIcon }',
    );
  });

  it("renders an explicit incomplete-configuration warning", () => {
    expect(settingsPage).toContain('role="alert"');
    expect(settingsPage).toContain("Hydration logging is paused");
    expect(settingsPage).toContain("Complete missing setup");
  });
});

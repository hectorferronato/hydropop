import { describe, expect, it } from "vitest";

import { toSaveOnboardingArguments } from "@/lib/application/onboarding/save-onboarding";
import { parseSetupFormData } from "@/lib/contracts/setup";

function createValidFormData(): FormData {
  const formData = new FormData();
  formData.set("bottleBrand", "Owala");
  formData.set("bottleCapacity", "24");
  formData.set("bottleId", "3a8d1d53-f6ab-4cc7-86f1-5a78382e3680");
  formData.set("bottleIsPrimary", "on");
  formData.set("bottleModel", "FreeSip");
  formData.set("bottleName", "Work bottle");
  formData.set("bottleTypicalFill", "20");
  formData.set("dailyGoal", "72");
  formData.set("displayName", "Bea");
  formData.set("preferredUnit", "oz");
  formData.set("targetCompletionTime", "20:00");
  formData.set("timezone", "America/New_York");
  formData.set("wakeTime", "07:00");

  return formData;
}

describe("onboarding form integration", () => {
  it("validates browser values and builds a milliliter-only RPC payload", () => {
    const parsed = parseSetupFormData(createValidFormData());

    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      throw new Error("Expected setup form to pass validation");
    }

    const arguments_ = toSaveOnboardingArguments(parsed.data);

    expect(arguments_).toMatchObject({
      p_bottle_capacity_ml: 710,
      p_bottle_typical_fill_ml: 591,
      p_daily_goal_ml: 2129,
      p_display_name: "Bea",
      p_preferred_unit: "oz",
      p_timezone: "America/New_York",
    });
    expect(arguments_).not.toHaveProperty("p_user_id");
    expect(Object.keys(arguments_)).not.toContain("user_id");
  });

  it("omits the optional bottle ID for first-time onboarding", () => {
    const formData = createValidFormData();
    formData.set("bottleId", "");
    const parsed = parseSetupFormData(formData);

    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      throw new Error("Expected first-time setup form to pass validation");
    }

    const arguments_ = toSaveOnboardingArguments(parsed.data);

    expect(arguments_).not.toHaveProperty("p_bottle_id");
  });

  it("preserves the existing bottle ID across repeated saves", () => {
    const firstParse = parseSetupFormData(createValidFormData());
    const secondParse = parseSetupFormData(createValidFormData());

    expect(firstParse.success).toBe(true);
    expect(secondParse.success).toBe(true);

    if (!firstParse.success || !secondParse.success) {
      throw new Error("Expected repeated setup forms to pass validation");
    }

    const firstArguments = toSaveOnboardingArguments(firstParse.data);
    const secondArguments = toSaveOnboardingArguments(secondParse.data);

    expect(firstArguments.p_bottle_id).toBe(
      "3a8d1d53-f6ab-4cc7-86f1-5a78382e3680",
    );
    expect(secondArguments.p_bottle_id).toBe(firstArguments.p_bottle_id);
  });

  it("keeps a blank typical fill null and omits its defaulted RPC argument", () => {
    const formData = createValidFormData();
    formData.set("bottleTypicalFill", "");
    const parsed = parseSetupFormData(formData);

    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      throw new Error("Expected blank typical fill to pass validation");
    }

    expect(parsed.data.bottleTypicalFillMl).toBeNull();
    expect(toSaveOnboardingArguments(parsed.data)).not.toHaveProperty(
      "p_bottle_typical_fill_ml",
    );
  });

  it("rejects a typical fill above physical capacity", () => {
    const formData = createValidFormData();
    formData.set("bottleTypicalFill", "25");
    const parsed = parseSetupFormData(formData);

    expect(parsed.success).toBe(false);

    if (parsed.success) {
      throw new Error("Expected typical fill above capacity to fail");
    }

    expect(parsed.fieldErrors.bottleTypicalFill).toContain(
      "Typical fill amount cannot exceed bottle capacity.",
    );
  });

  it("fails closed before persistence when ownership-sensitive input is invalid", () => {
    const formData = createValidFormData();
    formData.set("bottleId", "not-a-uuid");
    formData.set("timezone", "Not/A_Timezone");

    const parsed = parseSetupFormData(formData);

    expect(parsed.success).toBe(false);

    if (parsed.success) {
      throw new Error("Expected setup form to fail validation");
    }

    expect(parsed.fieldErrors.bottleId).toBeDefined();
    expect(parsed.fieldErrors.timezone).toBeDefined();
  });
});

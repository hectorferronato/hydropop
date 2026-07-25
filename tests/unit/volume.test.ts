import { describe, expect, it } from "vitest";

import {
  convertDisplayVolume,
  formatDisplayVolume,
  millilitersToOunces,
  ouncesToMilliliters,
  toStoredMilliliters,
} from "@/lib/units/volume";

describe("volume conversions", () => {
  it("converts US fluid ounces and milliliters", () => {
    expect(ouncesToMilliliters(24)).toBeCloseTo(709.765, 3);
    expect(millilitersToOunces(710)).toBeCloseTo(24.008, 3);
  });

  it("stores integer milliliters", () => {
    expect(toStoredMilliliters(24, "oz")).toBe(710);
    expect(toStoredMilliliters(710.4, "ml")).toBe(710);
  });

  it("formats saved milliliters in the selected unit", () => {
    expect(formatDisplayVolume(710, "oz")).toBe("24");
    expect(formatDisplayVolume(710, "ml")).toBe("710");
    expect(convertDisplayVolume(24, "oz", "ml")).toBe(710);
  });
});

import { describe, expect, it } from "vitest";

import {
  normalizeNfcFriendlyCode,
  reservedNfcFriendlyCodes,
  validateNfcFriendlyCode,
} from "@/lib/contracts/nfc-friendly-code";

describe("NFC friendly pilot codes", () => {
  it.each([
    ["bea", "bea"],
    [" Bea-Kitchen ", "bea-kitchen"],
    ["hector-yeti-1", "hector-yeti-1"],
  ])("normalizes and accepts %s", (input, expected) => {
    expect(normalizeNfcFriendlyCode(input)).toBe(expected);
    expect(validateNfcFriendlyCode(input)).toEqual({
      code: expected,
      error: null,
    });
  });

  it.each([
    "-bea",
    "bea-",
    "bea--kitchen",
    "Bea Kitchen",
    "bea_kitchen",
    "ab",
    "a".repeat(33),
  ])("rejects invalid code %s", (code) => {
    expect(validateNfcFriendlyCode(code).code).toBeNull();
  });

  it("rejects every reserved code after normalization", () => {
    for (const code of reservedNfcFriendlyCodes) {
      expect(validateNfcFriendlyCode(` ${code.toUpperCase()} `)).toEqual({
        code: null,
        error: "That code is reserved by HydroPOP.",
      });
    }
  });
});

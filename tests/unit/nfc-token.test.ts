import { describe, expect, it } from "vitest";

import { isValidPublicNfcToken } from "@/lib/contracts/nfc-token";

describe("public NFC tokens", () => {
  it("accepts appropriately sized URL-safe tokens", () => {
    expect(isValidPublicNfcToken("Abcdefghijklmnop_1234-token")).toBe(true);
  });

  it.each([
    "too-short",
    "contains spaces and punctuation!",
    "../private-destination",
  ])("rejects malformed token %s", (token) => {
    expect(isValidPublicNfcToken(token)).toBe(false);
  });
});

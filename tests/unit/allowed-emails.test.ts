import { describe, expect, it } from "vitest";

import {
  isEmailAllowed,
  parseAllowedEmails,
} from "@/lib/application/auth/allowed-emails";

describe("parseAllowedEmails", () => {
  it("normalizes comma-separated addresses", () => {
    const allowedEmails = parseAllowedEmails(
      " Person@Example.com, teammate@example.com ",
    );

    expect([...allowedEmails]).toEqual([
      "person@example.com",
      "teammate@example.com",
    ]);
  });

  it("fails closed when the configuration is missing", () => {
    expect(parseAllowedEmails(undefined).size).toBe(0);
  });

  it("fails closed when any configured address is invalid", () => {
    expect(parseAllowedEmails("valid@example.com,not-an-email").size).toBe(0);
  });
});

describe("isEmailAllowed", () => {
  const allowedEmails = parseAllowedEmails("person@example.com");

  it("matches normalized addresses", () => {
    expect(isEmailAllowed(" Person@Example.com ", allowedEmails)).toBe(true);
  });

  it("rejects missing and unlisted addresses", () => {
    expect(isEmailAllowed(undefined, allowedEmails)).toBe(false);
    expect(isEmailAllowed("other@example.com", allowedEmails)).toBe(false);
  });
});

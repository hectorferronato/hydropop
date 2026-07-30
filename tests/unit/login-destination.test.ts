import { describe, expect, it } from "vitest";

import {
  createLoginPath,
  sanitizeLoginDestination,
} from "@/lib/application/auth/login-destination";

describe("sanitizeLoginDestination", () => {
  it("preserves private app and NFC destinations", () => {
    expect(sanitizeLoginDestination("/calendar?month=2026-07")).toBe(
      "/calendar?month=2026-07",
    );
    expect(sanitizeLoginDestination("/settings/bottle")).toBe(
      "/settings/bottle",
    );
    expect(sanitizeLoginDestination("/trends?range=30")).toBe(
      "/trends?range=30",
    );
    expect(sanitizeLoginDestination("/community")).toBe("/community");
    expect(sanitizeLoginDestination("/profile")).toBe("/profile");
    expect(sanitizeLoginDestination("/t/Abcdefghijklmnop_1234")).toBe(
      "/t/Abcdefghijklmnop_1234",
    );
  });

  it.each([
    "https://attacker.example/t/token",
    "//attacker.example/path",
    "/auth/login",
    "/api/v1/private",
    "/today\\@attacker.example",
  ])("rejects unsafe destination %s", (destination) => {
    expect(sanitizeLoginDestination(destination)).toBe("/today");
  });

  it("encodes the intended route in the login URL", () => {
    expect(createLoginPath("/t/Abcdefghijklmnop_1234")).toBe(
      "/auth/login?next=%2Ft%2FAbcdefghijklmnop_1234",
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  createSetupPath,
  createLoginPath,
  isPilotNfcDestination,
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
    expect(sanitizeLoginDestination("/u/hector.ferronato")).toBe(
      "/u/hector.ferronato",
    );
    expect(sanitizeLoginDestination("/u/bea_1")).toBe("/u/bea_1");
    expect(sanitizeLoginDestination("/u/lais-zamper")).toBe("/u/lais-zamper");
    expect(sanitizeLoginDestination("/t/Abcdefghijklmnop_1234")).toBe(
      "/t/Abcdefghijklmnop_1234",
    );
    expect(sanitizeLoginDestination("/t/pilot")).toBe("/t/pilot");
  });

  it.each([
    "https://attacker.example/t/token",
    "//attacker.example/path",
    "/auth/login",
    "/api/v1/private",
    "/u/.hidden",
    "/u/hector/extra",
    "/today\\@attacker.example",
  ])("rejects unsafe destination %s", (destination) => {
    expect(sanitizeLoginDestination(destination)).toBe("/today");
  });

  it("encodes the intended route in the login URL", () => {
    expect(createLoginPath("/t/Abcdefghijklmnop_1234")).toBe(
      "/auth/login?next=%2Ft%2FAbcdefghijklmnop_1234",
    );
  });

  it("creates a safe pilot setup continuation without carrying arbitrary routes", () => {
    expect(isPilotNfcDestination("/t/pilot")).toBe(true);
    expect(createSetupPath("/t/pilot")).toBe("/setup?next=%2Ft%2Fpilot");
    expect(createSetupPath("/t/pilot", { completePartialSetup: true })).toBe(
      "/setup?mode=complete&next=%2Ft%2Fpilot",
    );
    expect(createSetupPath("https://attacker.example/t/pilot")).toBe("/setup");
  });
});

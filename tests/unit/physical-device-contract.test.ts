import { describe, expect, it, vi } from "vitest";

import { getPhysicalDeviceCredentialHash } from "@/lib/application/device/authenticate-device-request";
import { buildPhysicalDeviceStatusResponse } from "@/lib/application/device/build-device-status";
import { issuePhysicalDeviceCredential } from "@/lib/application/device/issue-physical-device-credential";
import {
  generatePhysicalDeviceToken,
  hashPhysicalDeviceToken,
  physicalDeviceTokenEntropyBytes,
} from "@/lib/application/device/token-security";
import {
  isValidPhysicalDeviceToken,
  physicalDeviceHydrationInputSchema,
} from "@/lib/contracts/physical-device";

describe("physical-device credential and request contract", () => {
  it("generates 256 random bits as a 43-character base64url token", () => {
    const token = generatePhysicalDeviceToken((size) =>
      new Uint8Array(size).fill(171),
    );

    expect(physicalDeviceTokenEntropyBytes).toBe(32);
    expect(token).toHaveLength(43);
    expect(isValidPhysicalDeviceToken(token)).toBe(true);
  });

  it("passes only the SHA-256 digest to persistence and returns the raw token once", async () => {
    let persistedValue: string | null = null;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const issued = await issuePhysicalDeviceCredential({
      mutate: async (credentialHash) => {
        persistedValue = credentialHash;
        return { data: { id: "device" }, error: null };
      },
    });

    expect(issued.rawToken).toHaveLength(43);
    expect(persistedValue).toBe(hashPhysicalDeviceToken(issued.rawToken));
    expect(persistedValue).not.toBe(issued.rawToken);
    expect(persistedValue).toMatch(/^[0-9a-f]{64}$/u);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("rejects missing, malformed, and non-256-bit bearer credentials", () => {
    expect(getPhysicalDeviceCredentialHash(null)).toBeNull();
    expect(getPhysicalDeviceCredentialHash("Basic abc")).toBeNull();
    expect(getPhysicalDeviceCredentialHash("Bearer short")).toBeNull();
    expect(getPhysicalDeviceCredentialHash(`Bearer ${"A".repeat(43)}`)).toMatch(
      /^[0-9a-f]{64}$/u,
    );
  });

  it("accepts only bottle_completed, a bounded safe key, and optional UTC time", () => {
    expect(
      physicalDeviceHydrationInputSchema.safeParse({
        action: "bottle_completed",
        idempotencyKey: "button-event-0001",
      }).success,
    ).toBe(true);
    expect(
      physicalDeviceHydrationInputSchema.safeParse({
        action: "bottle_completed",
        idempotencyKey: "button-event-0001",
        occurredAt: "2026-09-04T16:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it.each([
    { action: "manual_intake", idempotencyKey: "button-event-0001" },
    {
      action: "bottle_completed",
      bottleId: "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0",
      idempotencyKey: "button-event-0001",
    },
    {
      action: "bottle_completed",
      idempotencyKey: "button-event-0001",
      userId: "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c",
    },
    {
      action: "bottle_completed",
      idempotencyKey: "button-event-0001",
      volumeMl: 500,
    },
    { action: "bottle_completed", idempotencyKey: "unsafe key" },
    {
      action: "bottle_completed",
      idempotencyKey: "button-event-0001",
      occurredAt: "2026-09-04T12:00:00-04:00",
    },
  ])("rejects an unsafe device hydration body: %o", (input) => {
    expect(physicalDeviceHydrationInputSchema.safeParse(input).success).toBe(
      false,
    );
  });
});

describe("physical-device status projection", () => {
  it("reuses the shared pace calculation and recommends a half completion", () => {
    const response = buildPhysicalDeviceStatusResponse({
      goalMl: 3_000,
      localDate: "2026-09-04",
      normalCompletionMl: 1_000,
      serverTime: "2026-09-04T16:00:00.000Z",
      targetCompletionTime: "20:00:00",
      timezone: "America/New_York",
      todayMl: 500,
      unit: "oz",
      wakeTime: "07:00:00",
    });

    expect(response).toMatchObject({
      goalComplete: false,
      goalMl: 3_000,
      normalCompletionMl: 1_000,
      paceStatus: "behind",
      progressPercent: 17,
      recommendedAction: "half",
      todayMl: 500,
      unit: "oz",
      version: 1,
    });
    expect(response.paceDeltaMl).toBeLessThan(0);
  });

  it("returns goal_met with no further recommendation", () => {
    const response = buildPhysicalDeviceStatusResponse({
      goalMl: 2_000,
      localDate: "2026-09-04",
      normalCompletionMl: 1_000,
      serverTime: "2026-09-04T20:00:00.000Z",
      targetCompletionTime: "20:00:00",
      timezone: "America/New_York",
      todayMl: 2_000,
      unit: "ml",
      wakeTime: "07:00:00",
    });

    expect(response).toMatchObject({
      goalComplete: true,
      paceStatus: "goal_met",
      recommendedAction: "none",
    });
  });
});

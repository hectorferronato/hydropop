import { describe, expect, it } from "vitest";

import { hashPushEndpoint } from "@/lib/application/push/subscription-security";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import {
  notificationPreferenceInputSchema,
  pushSubscriptionInputSchema,
} from "@/lib/contracts/push-notifications";

const subscription = {
  endpoint: "https://push.example.test/subscription/abc",
  expirationTime: null,
  keys: { auth: "auth_token_123", p256dh: "public_key_material_123" },
};

describe("push notification browser contracts", () => {
  it("accepts only HTTPS endpoints and bounded encryption keys", () => {
    expect(pushSubscriptionInputSchema.safeParse(subscription).success).toBe(
      true,
    );
    expect(
      pushSubscriptionInputSchema.safeParse({
        ...subscription,
        endpoint: "http://push.example.test/abc",
      }).success,
    ).toBe(false);
    expect(
      pushSubscriptionInputSchema.safeParse({
        ...subscription,
        endpoint: "https://127.0.0.1/push",
      }).success,
    ).toBe(false);
    expect(
      pushSubscriptionInputSchema.safeParse({
        ...subscription,
        userId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });

  it("accepts only the explicit overall preference", () => {
    expect(
      notificationPreferenceInputSchema.safeParse({
        paceRemindersEnabled: true,
      }).success,
    ).toBe(true);
    expect(
      notificationPreferenceInputSchema.safeParse({
        paceRemindersEnabled: true,
        targetUserId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });

  it("hashes endpoints deterministically without retaining the endpoint", () => {
    const digest = hashPushEndpoint(subscription.endpoint);
    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
    expect(digest).toBe(hashPushEndpoint(subscription.endpoint));
    expect(digest).not.toContain("push.example.test");
  });

  it("rejects oversized JSON before validation", async () => {
    const request = new Request("https://hydropop.test/api", {
      body: JSON.stringify({ value: "x".repeat(20_000) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    await expect(readBoundedJson(request)).resolves.toBeNull();
  });
});

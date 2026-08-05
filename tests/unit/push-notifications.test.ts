import { describe, expect, it } from "vitest";

import { hashPushEndpoint } from "@/lib/application/push/subscription-security";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import {
  notificationPreferenceInputSchema,
  pushSubscriptionInputSchema,
} from "@/lib/contracts/push-notifications";
import { safeDatabaseDiagnostic } from "@/lib/infrastructure/supabase/safe-database-diagnostic";

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

  it("logs useful database diagnostics without leaking Push credentials", () => {
    expect(
      safeDatabaseDiagnostic("register_web_push_subscription", {
        code: "42501",
        details: "RLS rejected the requested row",
        hint: "Grant EXECUTE to the authenticated role",
        message: "permission denied for table web_push_subscriptions",
      }),
    ).toEqual({
      code: "42501",
      details: "RLS rejected the requested row",
      hint: "Grant EXECUTE to the authenticated role",
      message: "permission denied for table web_push_subscriptions",
      operation: "register_web_push_subscription",
    });

    const sensitive = safeDatabaseDiagnostic("register_web_push_subscription", {
      code: "42501",
      details:
        "Failing row contains https://push.example.test/private-endpoint and public_key_material_12345678901234567890",
      hint: "Bearer secret-material-that-must-never-appear",
      message: "request contained p256dh credential material",
    });

    expect(sensitive.details).toBe("[redacted]");
    expect(sensitive.hint).toBe("[redacted]");
    expect(sensitive.message).toBe("[redacted]");
    expect(JSON.stringify(sensitive)).not.toContain("private-endpoint");
    expect(JSON.stringify(sensitive)).not.toContain("secret-material");
  });
});

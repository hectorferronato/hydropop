import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  createPushServerClient: vi.fn(),
  getAllowedUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/infrastructure/supabase/auth", () => ({
  getAllowedUser: doubles.getAllowedUser,
}));

vi.mock("@/lib/infrastructure/supabase/push-server", () => ({
  createPushServerClient: doubles.createPushServerClient,
}));

import { PUT } from "@/app/api/v1/notification-preferences/route";

function preferenceRequest(body: unknown) {
  return new Request("https://hydropop.test/api/v1/notification-preferences", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}

describe("notification preference route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doubles.getAllowedUser.mockResolvedValue({
      status: "allowed",
      user: { id: "16c3e3f3-8319-4663-902e-9b24ae7c6a55" },
    });
    doubles.rpc.mockResolvedValue({
      data: {
        pace_reminders_enabled: true,
        updated_at: "2026-08-05T12:10:00.000Z",
      },
      error: null,
    });
    doubles.createPushServerClient.mockResolvedValue({ rpc: doubles.rpc });
  });

  it.each([true, false])(
    "allows an authenticated user to set reminders to %s",
    async (paceRemindersEnabled) => {
      const response = await PUT(preferenceRequest({ paceRemindersEnabled }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: { paceRemindersEnabled },
        error: null,
      });
      expect(doubles.rpc).toHaveBeenCalledWith(
        "set_hydration_notification_preferences",
        { p_pace_reminders_enabled: paceRemindersEnabled },
      );
      expect(JSON.stringify(doubles.rpc.mock.calls[0])).not.toContain(
        "user_id",
      );
    },
  );

  it("rejects an anonymous caller before opening a Supabase client", async () => {
    doubles.getAllowedUser.mockResolvedValue({ status: "unauthenticated" });

    const response = await PUT(
      preferenceRequest({ paceRemindersEnabled: true }),
    );

    expect(response.status).toBe(401);
    expect(doubles.createPushServerClient).not.toHaveBeenCalled();
    expect(doubles.rpc).not.toHaveBeenCalled();
  });

  it("rejects owner and server-state fields from the browser", async () => {
    for (const forbiddenField of [
      "user_id",
      "target_user_id",
      "reminder_count",
      "worker_secret",
    ]) {
      const response = await PUT(
        preferenceRequest({
          [forbiddenField]: "not-accepted",
          paceRemindersEnabled: true,
        }),
      );

      expect(response.status).toBe(400);
    }

    expect(doubles.rpc).not.toHaveBeenCalled();
  });

  it("returns no account, subscription, or reminder-state fields", async () => {
    const response = await PUT(
      preferenceRequest({ paceRemindersEnabled: true }),
    );
    const responseBody = await response.json();
    const serialized = JSON.stringify(responseBody);

    expect(serialized).not.toContain("user_id");
    expect(serialized).not.toContain("endpoint");
    expect(serialized).not.toContain("p256dh");
    expect(serialized).not.toContain("reminder_count");
    expect(responseBody).toEqual({
      data: { paceRemindersEnabled: true },
      error: null,
    });
  });
});

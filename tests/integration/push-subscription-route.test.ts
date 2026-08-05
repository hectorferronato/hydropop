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

import { POST } from "@/app/api/v1/push-subscriptions/route";

const payload = {
  endpoint: "https://push.example.test/subscription/abc",
  expirationTime: null,
  keys: { auth: "auth_token_123", p256dh: "public_key_material_123" },
};

function registrationRequest(body: unknown = payload) {
  return new Request("https://hydropop.test/api/v1/push-subscriptions", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "user-agent": "HydroPOP test browser",
    },
    method: "POST",
  });
}

describe("Push subscription registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doubles.getAllowedUser.mockResolvedValue({
      status: "allowed",
      user: { id: "4a1ce112-3d27-4c25-9bf2-d119fd72e743" },
    });
    doubles.rpc.mockResolvedValue({
      data: {
        active: true,
        registered: true,
        subscription_id: "827e77d8-bc0a-4de0-9c84-341ef4794931",
      },
      error: null,
    });
    doubles.createPushServerClient.mockResolvedValue({ rpc: doubles.rpc });
  });

  it("registers an authenticated user's device without passing an owner ID", async () => {
    const response = await POST(registrationRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: { registered: true },
      error: null,
    });
    expect(doubles.rpc).toHaveBeenCalledWith("register_web_push_subscription", {
      p_auth: payload.keys.auth,
      p_endpoint: payload.endpoint,
      p_expires_at: null,
      p_p256dh: payload.keys.p256dh,
      p_platform: "other",
      p_user_agent: "HydroPOP test browser",
    });

    const serializedCall = JSON.stringify(doubles.rpc.mock.calls[0]);
    expect(serializedCall).not.toContain("user_id");
    expect(serializedCall).not.toContain("userId");
    expect(serializedCall).not.toContain("endpoint_hash");
  });

  it("rejects anonymous callers before opening a Supabase client", async () => {
    doubles.getAllowedUser.mockResolvedValue({ status: "unauthenticated" });

    const response = await POST(registrationRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      data: null,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(doubles.createPushServerClient).not.toHaveBeenCalled();
    expect(doubles.rpc).not.toHaveBeenCalled();
  });

  it("rejects a browser-supplied user ID before registration", async () => {
    const response = await POST(
      registrationRequest({
        ...payload,
        user_id: "f5fff0ee-ea7c-4527-862a-e5678d5d32a0",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      data: null,
      error: { code: "INVALID_INPUT" },
    });
    expect(doubles.rpc).not.toHaveBeenCalled();
  });
});

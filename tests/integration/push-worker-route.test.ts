import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPushWorkerClient: vi.fn(),
  evaluatePaceReminder: vi.fn(),
  getPushWorkerSecret: vi.fn(),
  isValidStoredPushSubscription: vi.fn(),
  rpc: vi.fn(),
  sendWebPush: vi.fn(),
}));

vi.mock("@/lib/domain/coaching/pace-reminder", () => ({
  evaluatePaceReminder: mocks.evaluatePaceReminder,
}));

vi.mock("@/lib/infrastructure/push/config", () => ({
  getPushWorkerSecret: mocks.getPushWorkerSecret,
}));

vi.mock("@/lib/infrastructure/push/send", () => ({
  isValidStoredPushSubscription: mocks.isValidStoredPushSubscription,
  sendWebPush: mocks.sendWebPush,
}));

vi.mock("@/lib/infrastructure/supabase/push", () => ({
  createPushWorkerClient: mocks.createPushWorkerClient,
}));

import { POST } from "@/app/api/internal/push-reminders/run/route";

const workerSecret = "a".repeat(64);

function workerRequest(bearer: string | null = workerSecret) {
  const headers = new Headers({ "content-type": "application/json" });
  if (bearer !== null) headers.set("authorization", `Bearer ${bearer}`);

  return new Request("https://hydropop.test/api/internal/push-reminders/run", {
    body: "{}",
    headers,
    method: "POST",
  });
}

describe("internal Push reminder worker route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPushWorkerSecret.mockReturnValue(workerSecret);
    mocks.createPushWorkerClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.isValidStoredPushSubscription.mockReturnValue(true);
    mocks.evaluatePaceReminder.mockReturnValue({
      body: "A gentle hydration check-in.",
      paceStatus: "behind",
      shouldSend: true,
      title: "HydroPOP check-in",
    });
  });

  it("rejects missing worker configuration and bearer credentials", async () => {
    mocks.getPushWorkerSecret.mockImplementationOnce(() => {
      throw new Error("not configured");
    });
    const unconfigured = await POST(workerRequest());
    expect(unconfigured.status).toBe(503);

    const missing = await POST(workerRequest(null));
    const incorrect = await POST(workerRequest("b".repeat(64)));
    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(mocks.createPushWorkerClient).not.toHaveBeenCalled();
  });

  it("completes an authorized no-work run with aggregate zero counts", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { candidates: [] }, error: null })
      .mockResolvedValueOnce({ data: { deliveries: [] }, error: null });

    const response = await POST(workerRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      delivered: 0,
      enqueued: 0,
      evaluated: 0,
      processed: 0,
    });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "claim_push_reminder_evaluations",
      "claim_push_notification_outbox",
    ]);
  });

  it("passes due work through evaluation, enqueue, claim, and completion", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          candidates: [
            {
              behind_episode: 0,
              evaluation_token: "06d0f502-2f55-46fe-9cb8-ac2eefbdf3ba",
              goal_ml: 2400,
              last_hydration_at: null,
              last_pace_status: null,
              last_reminder_attempted_at: null,
              last_reminder_sent_at: null,
              local_date: "2026-08-05",
              normal_fill_ml: 700,
              preferred_unit: "ml",
              reminder_count: 0,
              target_completion_time: "20:00:00",
              timezone: "UTC",
              today_intake_ml: 300,
              user_id: "a685af01-4a22-420a-b9ca-92fb27a98eb0",
              wake_time: "08:00:00",
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { applied: true, enqueued: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          deliveries: [
            {
              attempt: 1,
              claim_token: "8393b1e4-c6d4-491c-b1fa-a60e06b22ed4",
              id: "26449122-c28a-4665-a99f-36cda289fa78",
              notification: {
                body: "A gentle hydration check-in.",
                kind: "pace-reminder",
                tag: "hydropop-pace",
                target: "/today?record=1&source=push",
                title: "HydroPOP check-in",
                version: 1,
              },
              subscriptions: [],
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { completed: true, status: "failed" },
        error: null,
      });

    const response = await POST(workerRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      delivered: 0,
      enqueued: 1,
      evaluated: 1,
      processed: 1,
    });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "claim_push_reminder_evaluations",
      "apply_push_reminder_evaluation",
      "claim_push_notification_outbox",
      "complete_push_notification_outbox",
    ]);
    expect(mocks.sendWebPush).not.toHaveBeenCalled();
  });
});

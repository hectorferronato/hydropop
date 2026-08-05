import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { evaluatePaceReminder } from "@/lib/domain/coaching/pace-reminder";
import { getPushWorkerSecret } from "@/lib/infrastructure/push/config";
import {
  isValidStoredPushSubscription,
  sendWebPush,
} from "@/lib/infrastructure/push/send";
import { createPushWorkerClient } from "@/lib/infrastructure/supabase/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const candidateSchema = z.object({
  behind_episode: z.number().int().nonnegative(),
  evaluation_token: z.uuid(),
  goal_ml: z.number().int().positive().nullable(),
  last_hydration_at: z.string().nullable(),
  last_pace_status: z.string().nullable(),
  last_reminder_attempted_at: z.string().nullable(),
  last_reminder_sent_at: z.string().nullable(),
  local_date: z.string(),
  normal_fill_ml: z.number().int().positive().nullable(),
  preferred_unit: z.unknown(),
  reminder_count: z.number().int().min(0).max(4),
  target_completion_time: z.string().nullable(),
  timezone: z.string(),
  today_intake_ml: z.number().nonnegative(),
  user_id: z.uuid(),
  wake_time: z.string().nullable(),
});

const evaluationBatchSchema = z.object({
  candidates: z.array(candidateSchema),
});

const notificationSchema = z.object({
  body: z.string().min(1).max(180),
  kind: z.literal("pace-reminder"),
  tag: z.literal("hydropop-pace"),
  target: z.literal("/today?record=1&source=push"),
  title: z.string().min(1).max(80),
  version: z.literal(1),
});

const deliverySchema = z.object({
  attempt: z.number().int().positive(),
  claim_token: z.uuid(),
  id: z.uuid(),
  notification: notificationSchema,
  subscriptions: z.array(
    z.object({
      auth: z.string(),
      endpoint: z.string(),
      id: z.uuid(),
      p256dh: z.string(),
    }),
  ),
});

const deliveryBatchSchema = z.object({ deliveries: z.array(deliverySchema) });

function authorized(request: Request, expectedSecret: string): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expectedSecret).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

function pushStatusCode(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return null;
}

function workerResponse(body: object, status = 200): Response {
  return Response.json(body, {
    headers: { "cache-control": "no-store" },
    status,
  });
}

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = getPushWorkerSecret();
  } catch {
    return workerResponse({ error: "WORKER_NOT_CONFIGURED" }, 503);
  }

  if (!authorized(request, secret)) {
    return workerResponse({ error: "UNAUTHORIZED" }, 401);
  }

  const now = new Date();
  const supabase = createPushWorkerClient();
  const { data: evaluationData, error: evaluationError } = await supabase.rpc(
    "claim_push_reminder_evaluations",
    { p_limit: 50, p_now: now.toISOString(), p_worker_secret: secret },
  );
  const evaluations = evaluationBatchSchema.safeParse(evaluationData);
  if (evaluationError || !evaluations.success) {
    console.error("[HydroPOP] Push evaluation claim failed.", {
      code: evaluationError?.code ?? "INVALID_RPC_RESPONSE",
    });
    return workerResponse({ error: "WORKER_FAILED" }, 500);
  }

  let enqueued = 0;
  for (const candidate of evaluations.data.candidates) {
    const decision = evaluatePaceReminder(
      {
        behindEpisode: candidate.behind_episode,
        goalMl: candidate.goal_ml,
        lastHydrationAt: candidate.last_hydration_at,
        lastPaceStatus: candidate.last_pace_status,
        lastReminderAttemptedAt: candidate.last_reminder_attempted_at,
        lastReminderSentAt: candidate.last_reminder_sent_at,
        localDate: candidate.local_date,
        normalFillMl: candidate.normal_fill_ml,
        preferredUnit: candidate.preferred_unit,
        reminderCount: candidate.reminder_count,
        targetCompletionTime: candidate.target_completion_time,
        timezone: candidate.timezone,
        todayIntakeMl: candidate.today_intake_ml,
        wakeTime: candidate.wake_time,
      },
      now,
    );
    const { data, error } = await supabase.rpc(
      "apply_push_reminder_evaluation",
      {
        ...(decision.body ? { p_body: decision.body } : {}),
        p_evaluation_token: candidate.evaluation_token,
        p_now: now.toISOString(),
        p_pace_status: decision.paceStatus,
        p_should_send: decision.shouldSend,
        ...(decision.title ? { p_title: decision.title } : {}),
        p_user_id: candidate.user_id,
        p_worker_secret: secret,
      },
    );
    if (error) {
      console.error("[HydroPOP] Push evaluation commit failed.", {
        code: error.code,
      });
      continue;
    }
    if (
      typeof data === "object" &&
      data !== null &&
      !Array.isArray(data) &&
      data.enqueued === true
    ) {
      enqueued += 1;
    }
  }

  const { data: deliveryData, error: deliveryError } = await supabase.rpc(
    "claim_push_notification_outbox",
    { p_limit: 25, p_now: now.toISOString(), p_worker_secret: secret },
  );
  const deliveries = deliveryBatchSchema.safeParse(deliveryData);
  if (deliveryError || !deliveries.success) {
    console.error("[HydroPOP] Push delivery claim failed.", {
      code: deliveryError?.code ?? "INVALID_RPC_RESPONSE",
    });
    return workerResponse({ error: "WORKER_FAILED" }, 500);
  }

  let delivered = 0;
  for (const delivery of deliveries.data.deliveries) {
    let acceptedCount = 0;
    const permanentFailures: string[] = [];
    const successfulSubscriptions: string[] = [];
    let transientFailure = false;

    await Promise.all(
      delivery.subscriptions.map(async (subscription) => {
        if (!isValidStoredPushSubscription(subscription)) {
          permanentFailures.push(subscription.id);
          return;
        }

        try {
          await sendWebPush(subscription, delivery.notification);
          acceptedCount += 1;
          successfulSubscriptions.push(subscription.id);
        } catch (error) {
          const statusCode = pushStatusCode(error);
          if (statusCode === 404 || statusCode === 410) {
            permanentFailures.push(subscription.id);
          } else {
            transientFailure = true;
          }
        }
      }),
    );

    const retryAt =
      acceptedCount === 0 && transientFailure
        ? new Date(
            now.getTime() + Math.min(60, 2 ** delivery.attempt) * 60_000,
          ).toISOString()
        : undefined;
    const { error: completionError } = await supabase.rpc(
      "complete_push_notification_outbox",
      {
        p_accepted_count: acceptedCount,
        p_claim_token: delivery.claim_token,
        ...(transientFailure ? { p_error_code: "TRANSIENT_PUSH_FAILURE" } : {}),
        p_now: now.toISOString(),
        p_outbox_id: delivery.id,
        p_permanent_failure_subscription_ids: permanentFailures,
        p_success_subscription_ids: successfulSubscriptions,
        ...(retryAt ? { p_retry_at: retryAt } : {}),
        p_worker_secret: secret,
      },
    );
    if (completionError) {
      console.error("[HydroPOP] Push delivery completion failed.", {
        code: completionError.code,
      });
    } else if (acceptedCount > 0) {
      delivered += 1;
    }
  }

  return workerResponse({
    delivered,
    enqueued,
    evaluated: evaluations.data.candidates.length,
    processed: deliveries.data.deliveries.length,
  });
}

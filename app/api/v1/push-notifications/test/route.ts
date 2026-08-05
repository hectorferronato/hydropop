import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import { hashPushEndpoint } from "@/lib/application/push/subscription-security";
import { testPushInputSchema } from "@/lib/contracts/push-notifications";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { sendWebPush } from "@/lib/infrastructure/push/send";
import { createPushServerClient } from "@/lib/infrastructure/supabase/push-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function POST(request: Request) {
  const authentication = await getAllowedUser();
  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const parsed = testPushInputSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return apiFailure("INVALID_INPUT");

  const supabase = await createPushServerClient();
  const { data: subscription, error } = await supabase
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", authentication.user.id)
    .eq("endpoint_hash", hashPushEndpoint(parsed.data.endpoint))
    .is("revoked_at", null)
    .maybeSingle();

  if (error) return apiFailure("INTERNAL_ERROR");
  if (!subscription) return apiFailure("PUSH_SUBSCRIPTION_NOT_FOUND");

  try {
    await sendWebPush(subscription, {
      body: "Hydration reminders are enabled on this device.",
      kind: "test",
      tag: `hydropop-test-${randomUUID()}`,
      target: "/today",
      title: "HydroPOP is ready 💧",
      version: 1,
    });
    return apiSuccess({ sent: true });
  } catch (pushError) {
    const statusCode = pushStatusCode(pushError);
    if (statusCode === 404 || statusCode === 410) {
      await supabase
        .from("web_push_subscriptions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", subscription.id);
      return apiFailure("PUSH_SUBSCRIPTION_NOT_FOUND");
    }

    console.error("[HydroPOP] Test push delivery failed.", {
      statusCode: statusCode ?? "UNKNOWN",
    });
    return apiFailure("INTERNAL_ERROR");
  }
}
import { randomUUID } from "node:crypto";

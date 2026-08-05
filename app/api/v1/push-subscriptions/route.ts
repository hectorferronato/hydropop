import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import {
  describePushPlatform,
  hashPushEndpoint,
} from "@/lib/application/push/subscription-security";
import {
  pushSubscriptionInputSchema,
  pushSubscriptionRemovalSchema,
} from "@/lib/contracts/push-notifications";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createPushServerClient } from "@/lib/infrastructure/supabase/push-server";
import { safeDatabaseDiagnostic } from "@/lib/infrastructure/supabase/safe-database-diagnostic";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authentication = await getAllowedUser();
  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const parsed = pushSubscriptionInputSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) return apiFailure("INVALID_INPUT");

  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const supabase = await createPushServerClient();
  const { error } = await supabase.rpc("register_web_push_subscription", {
    p_auth: parsed.data.keys.auth,
    p_endpoint: parsed.data.endpoint,
    p_expires_at:
      parsed.data.expirationTime === null
        ? null
        : new Date(parsed.data.expirationTime).toISOString(),
    p_p256dh: parsed.data.keys.p256dh,
    p_platform: describePushPlatform(userAgent ?? ""),
    p_user_agent: userAgent,
  });

  if (error) {
    console.error(
      "[HydroPOP] Push subscription registration failed.",
      safeDatabaseDiagnostic("register_web_push_subscription", error),
    );
    return apiFailure("INTERNAL_ERROR");
  }

  return apiSuccess({ registered: true }, 201);
}

export async function DELETE(request: Request) {
  const authentication = await getAllowedUser();
  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const parsed = pushSubscriptionRemovalSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) return apiFailure("INVALID_INPUT");

  const { error } = await (
    await createPushServerClient()
  )
    .from("web_push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", authentication.user.id)
    .eq("endpoint_hash", hashPushEndpoint(parsed.data.endpoint))
    .is("revoked_at", null);

  if (error) {
    console.error(
      "[HydroPOP] Push subscription revocation failed.",
      safeDatabaseDiagnostic("revoke_web_push_subscription", error),
    );
    return apiFailure("INTERNAL_ERROR");
  }

  return apiSuccess({ revoked: true });
}

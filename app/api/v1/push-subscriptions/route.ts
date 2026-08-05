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
  const endpointHash = hashPushEndpoint(parsed.data.endpoint);
  const supabase = await createPushServerClient();
  const { error } = await supabase.from("web_push_subscriptions").upsert(
    {
      auth: parsed.data.keys.auth,
      endpoint: parsed.data.endpoint,
      endpoint_hash: endpointHash,
      expires_at:
        parsed.data.expirationTime === null
          ? null
          : new Date(parsed.data.expirationTime).toISOString(),
      p256dh: parsed.data.keys.p256dh,
      platform: describePushPlatform(userAgent ?? ""),
      revoked_at: null,
      user_agent: userAgent,
      user_id: authentication.user.id,
    },
    { onConflict: "endpoint_hash" },
  );

  if (error) {
    console.error("[HydroPOP] Push subscription registration failed.", {
      code: error.code,
    });
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
    console.error("[HydroPOP] Push subscription revocation failed.", {
      code: error.code,
    });
    return apiFailure("INTERNAL_ERROR");
  }

  return apiSuccess({ revoked: true });
}

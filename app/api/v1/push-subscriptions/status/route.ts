import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { readBoundedJson } from "@/lib/application/http/read-bounded-json";
import { hashPushEndpoint } from "@/lib/application/push/subscription-security";
import { pushSubscriptionRemovalSchema } from "@/lib/contracts/push-notifications";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createPushServerClient } from "@/lib/infrastructure/supabase/push-server";
export const dynamic = "force-dynamic";
// Read-only POST keeps the endpoint out of URL/access logs.
export async function POST(request: Request) {
  const authentication = await getAllowedUser();
  if (authentication.status !== "allowed")
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  const parsed = pushSubscriptionRemovalSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) return apiFailure("INVALID_INPUT");
  const { count, error } = await (
    await createPushServerClient()
  )
    .from("web_push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authentication.user.id)
    .eq("endpoint_hash", hashPushEndpoint(parsed.data.endpoint))
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  if (error) return apiFailure("INTERNAL_ERROR");
  return apiSuccess({ registered: (count ?? 0) > 0 });
}

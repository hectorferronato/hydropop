import { createBottleInputSchema } from "@/lib/contracts/bottles";
import { apiFailure, apiSuccess } from "@/lib/application/http/api-route";
import { getAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createClient } from "@/lib/infrastructure/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  const { data, error } = await (
    await createClient()
  )
    .from("bottles")
    .select(
      "archived_at, brand, capacity_ml, created_at, id, is_primary, model, name",
    )
    .eq("user_id", authentication.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[HydroPOP] Bottle list query failed.", { code: error.code });
    return apiFailure("INTERNAL_ERROR");
  }

  return apiSuccess(data ?? []);
}

export async function POST(request: Request) {
  const authentication = await getAllowedUser();

  if (authentication.status !== "allowed") {
    return apiFailure(
      authentication.status === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiFailure("INVALID_INPUT");
  }

  const parsed = createBottleInputSchema.safeParse(body);

  if (!parsed.success) {
    return apiFailure("INVALID_INPUT");
  }

  const { data, error } = await (
    await createClient()
  )
    .from("bottles")
    .insert({
      brand: parsed.data.brand || null,
      capacity_ml: parsed.data.capacityMl,
      is_primary: parsed.data.isPrimary,
      model: parsed.data.model || null,
      name: parsed.data.name,
      user_id: authentication.user.id,
    })
    .select(
      "archived_at, brand, capacity_ml, created_at, id, is_primary, model, name",
    )
    .single();

  if (error) {
    console.error("[HydroPOP] Bottle creation failed.", { code: error.code });
    return apiFailure("INVALID_INPUT");
  }

  return apiSuccess(data, 201);
}

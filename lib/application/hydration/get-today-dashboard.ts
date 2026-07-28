import type { SupabaseClient } from "@supabase/supabase-js";

import type { TodayDashboard } from "@/lib/contracts/dashboard";
import type { Database } from "@/lib/infrastructure/supabase/database.types";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

import { buildTodayDashboard } from "./hydration-projection";

export async function getTodayDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<TodayDashboard> {
  return buildTodayDashboard(await getHydrationSnapshot(supabase, userId), now);
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TodayDashboard } from "@/lib/contracts/dashboard";
import type { PendingDatabase } from "@/lib/infrastructure/supabase/database.pending-types";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

import { buildTodayDashboard } from "./hydration-projection";

export async function getTodayDashboard(
  supabase: SupabaseClient<PendingDatabase>,
  userId: string,
  now = new Date(),
): Promise<TodayDashboard> {
  return buildTodayDashboard(await getHydrationSnapshot(supabase, userId), now);
}

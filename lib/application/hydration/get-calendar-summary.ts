import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarSummary } from "@/lib/contracts/calendar";
import type { Database } from "@/lib/infrastructure/supabase/database.types";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";

import { buildCalendarSummary } from "./hydration-projection";

export async function getCalendarSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
  month: string,
): Promise<CalendarSummary> {
  return buildCalendarSummary(
    await getHydrationSnapshot(supabase, userId),
    month,
  );
}

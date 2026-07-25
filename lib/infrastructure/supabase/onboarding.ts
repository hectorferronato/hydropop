import type { SupabaseClient } from "@supabase/supabase-js";

import { getDateInTimezone } from "@/lib/domain/hydration/hydration-day";

import type { Database } from "./database.types";

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "display_name"
  | "preferred_unit"
  | "target_completion_time"
  | "timezone"
  | "wake_time"
>;

type Bottle = Pick<
  Database["public"]["Tables"]["bottles"]["Row"],
  "brand" | "capacity_ml" | "id" | "is_primary" | "model" | "name"
>;

type HydrationGoal = Pick<
  Database["public"]["Tables"]["hydration_goals"]["Row"],
  "daily_goal_ml" | "id" | "target_completion_time"
>;

export type OnboardingSnapshot = {
  bottle: Bottle | null;
  goal: HydrationGoal | null;
  isComplete: boolean;
  profile: Profile | null;
};

export async function getOnboardingSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OnboardingSnapshot> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "display_name, preferred_unit, target_completion_time, timezone, wake_time",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error("Unable to load the user profile.");
  }

  const timezone = profile?.timezone ?? "America/New_York";
  const hydrationDay = getDateInTimezone(timezone);

  const [bottleResult, goalResult] = await Promise.all([
    supabase
      .from("bottles")
      .select("brand, capacity_ml, id, is_primary, model, name")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("hydration_goals")
      .select("daily_goal_ml, id, target_completion_time")
      .eq("user_id", userId)
      .lte("effective_from", hydrationDay)
      .or(`effective_until.is.null,effective_until.gte.${hydrationDay}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (bottleResult.error || goalResult.error) {
    throw new Error("Unable to load onboarding preferences.");
  }

  const bottle = bottleResult.data;
  const goal = goalResult.data;
  const isComplete = Boolean(
    profile?.display_name?.trim() &&
    profile.wake_time &&
    profile.target_completion_time &&
    bottle?.is_primary &&
    goal,
  );

  return { bottle, goal, isComplete, profile };
}

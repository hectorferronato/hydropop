import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getOnboardingStatus,
  type OnboardingStatus,
} from "@/lib/application/onboarding/onboarding-status";
import { getDateInTimezone } from "@/lib/domain/hydration/hydration-day";

import type { Database } from "./database.types";

export type SetupProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "display_name"
  | "preferred_unit"
  | "target_completion_time"
  | "timezone"
  | "wake_time"
>;

export type SetupBottle = Pick<
  Database["public"]["Tables"]["bottles"]["Row"],
  | "brand"
  | "capacity_ml"
  | "id"
  | "is_primary"
  | "model"
  | "name"
  | "typical_fill_ml"
>;

export type SetupHydrationGoal = Pick<
  Database["public"]["Tables"]["hydration_goals"]["Row"],
  "daily_goal_ml" | "effective_from" | "id" | "target_completion_time"
>;

export type OnboardingSnapshot = {
  bottle: SetupBottle | null;
  goal: SetupHydrationGoal | null;
  isComplete: boolean;
  profile: SetupProfile | null;
  status: OnboardingStatus;
};

type QueryFailure = {
  code: string;
};

type QueryResult<Row> = {
  data: Row | null;
  error: QueryFailure | null;
};

export type OnboardingSnapshotDataSource = {
  getActiveGoal(
    userId: string,
    hydrationDay: string,
  ): Promise<QueryResult<SetupHydrationGoal>>;
  getPrimaryBottle(userId: string): Promise<QueryResult<SetupBottle>>;
  getProfile(userId: string): Promise<QueryResult<SetupProfile>>;
};

export class SetupReadError extends Error {
  constructor(resource: "active goal" | "primary bottle" | "profile") {
    super(`Unable to load the persisted setup ${resource}.`);
    this.name = "SetupReadError";
  }
}

function throwSetupReadError(
  resource: "active goal" | "primary bottle" | "profile",
  failure: QueryFailure,
): never {
  console.error(`[HydroPOP] Setup ${resource} query failed.`, {
    code: failure.code,
  });
  throw new SetupReadError(resource);
}

export function createSupabaseOnboardingDataSource(
  supabase: SupabaseClient<Database>,
): OnboardingSnapshotDataSource {
  return {
    async getActiveGoal(userId, hydrationDay) {
      return await supabase
        .from("hydration_goals")
        .select("daily_goal_ml, effective_from, id, target_completion_time")
        .eq("user_id", userId)
        .lte("effective_from", hydrationDay)
        .or(`effective_until.is.null,effective_until.gte.${hydrationDay}`)
        .order("effective_from", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
    },
    async getPrimaryBottle(userId) {
      return await supabase
        .from("bottles")
        .select(
          "brand, capacity_ml, id, is_primary, model, name, typical_fill_ml",
        )
        .eq("user_id", userId)
        .eq("is_primary", true)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
    },
    async getProfile(userId) {
      return await supabase
        .from("profiles")
        .select(
          "display_name, preferred_unit, target_completion_time, timezone, wake_time",
        )
        .eq("id", userId)
        .maybeSingle();
    },
  };
}

export async function loadOnboardingSnapshot(
  dataSource: OnboardingSnapshotDataSource,
  userId: string,
  instant = new Date(),
): Promise<OnboardingSnapshot> {
  const { data: profile, error: profileError } =
    await dataSource.getProfile(userId);

  if (profileError) {
    throwSetupReadError("profile", profileError);
  }

  const timezone = profile?.timezone ?? "America/New_York";
  const hydrationDay = getDateInTimezone(timezone, instant);

  const [bottleResult, goalResult] = await Promise.all([
    dataSource.getPrimaryBottle(userId),
    dataSource.getActiveGoal(userId, hydrationDay),
  ]);

  if (bottleResult.error) {
    throwSetupReadError("primary bottle", bottleResult.error);
  }

  if (goalResult.error) {
    throwSetupReadError("active goal", goalResult.error);
  }

  const bottle = bottleResult.data;
  const goal = goalResult.data;
  const status = getOnboardingStatus({ bottle, goal, profile });

  return {
    bottle,
    goal,
    isComplete: status.isComplete,
    profile,
    status,
  };
}

export async function getOnboardingSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OnboardingSnapshot> {
  return loadOnboardingSnapshot(
    createSupabaseOnboardingDataSource(supabase),
    userId,
  );
}

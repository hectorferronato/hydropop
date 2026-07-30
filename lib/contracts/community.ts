import { z } from "zod";

import { validateCommunityUsername } from "@/lib/domain/community/username";

export const communityErrorCodes = [
  "COMMUNITY_ACCESS_REQUIRED",
  "COMMUNITY_MEMBER_UNAVAILABLE",
  "COMMUNITY_PROFILE_NOT_FOUND",
  "UNAUTHORIZED",
  "USERNAME_INVALID",
  "USERNAME_RESERVED",
  "USERNAME_UNAVAILABLE",
  "VALIDATION_ERROR",
] as const;

export type CommunityErrorCode = (typeof communityErrorCodes)[number];

const usernameSchema = z.string().transform((value, context) => {
  const result = validateCommunityUsername(value);

  if (result.error || !result.username) {
    context.addIssue({
      code: "custom",
      message: result.error ?? "USERNAME_INVALID",
    });
    return z.NEVER;
  }

  return result.username;
});

export const communityProfileInputSchema = z
  .object({
    isVisible: z.boolean(),
    username: usernameSchema,
  })
  .strict();

export const communityProfileSchema = z
  .object({
    display_name: z.string().min(1).max(80),
    is_visible: z.boolean(),
    joined_at: z.string(),
    username: z.string(),
  })
  .strict()
  .transform((profile) => ({
    displayName: profile.display_name,
    isVisible: profile.is_visible,
    joinedAt: profile.joined_at,
    username: profile.username,
  }));

const communityDaySchema = z
  .object({
    date: z.string(),
    goal_ml: z.number().int().positive().nullable(),
    intake_ml: z.number().int().nonnegative(),
  })
  .strict()
  .transform((day) => ({
    date: day.date,
    goalMl: day.goal_ml,
    intakeMl: day.intake_ml,
  }));

export const communityMemberSummarySchema = z
  .object({
    completed_bottles_this_week: z.number().int().nonnegative().optional(),
    current_streak: z.number().int().nonnegative(),
    daily: z.array(communityDaySchema).optional(),
    display_name: z.string().min(1).max(80),
    joined_at: z.string(),
    seven_day_average_ml: z.number().int().nonnegative(),
    seven_day_eligible_days: z.number().int().nonnegative(),
    seven_day_goal_days: z.number().int().nonnegative(),
    today_goal_ml: z.number().int().positive().nullable(),
    today_intake_ml: z.number().int().nonnegative(),
    username: z.string(),
  })
  .strict()
  .transform((summary) => ({
    completedBottlesThisWeek: summary.completed_bottles_this_week ?? null,
    currentStreak: summary.current_streak,
    daily: summary.daily ?? [],
    displayName: summary.display_name,
    joinedAt: summary.joined_at,
    sevenDayAverageMl: summary.seven_day_average_ml,
    sevenDayEligibleDays: summary.seven_day_eligible_days,
    sevenDayGoalDays: summary.seven_day_goal_days,
    todayGoalMl: summary.today_goal_ml,
    todayIntakeMl: summary.today_intake_ml,
    username: summary.username,
  }));

export const communityDirectorySchema = z
  .object({
    members: z.array(communityMemberSummarySchema).max(50),
  })
  .strict()
  .transform((directory) => directory.members);

export const communityMemberResultSchema = z.union([
  z
    .object({
      error_code: z.literal("COMMUNITY_MEMBER_UNAVAILABLE"),
    })
    .strict()
    .transform(() => null),
  communityMemberSummarySchema,
]);

export const communityUsernameAvailabilitySchema = z
  .object({
    available: z.boolean(),
    error_code: z
      .enum(["USERNAME_INVALID", "USERNAME_RESERVED", "USERNAME_UNAVAILABLE"])
      .nullable(),
    username: z.string(),
  })
  .strict()
  .transform((availability) => ({
    available: availability.available,
    errorCode: availability.error_code,
    username: availability.username,
  }));

export type CommunityProfile = z.output<typeof communityProfileSchema>;
export type CommunityMemberSummary = z.output<
  typeof communityMemberSummarySchema
>;
export type CommunityUsernameAvailability = z.output<
  typeof communityUsernameAvailabilitySchema
>;

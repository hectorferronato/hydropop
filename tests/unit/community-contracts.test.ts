import { describe, expect, it } from "vitest";

import {
  filterCommunityMembers,
  formatCommunityVolume,
  getCommunityGoalPercentage,
  getCommunityInitials,
} from "@/lib/application/community/presentation";
import {
  communityDirectorySchema,
  communityMemberResultSchema,
  communityProfileInputSchema,
} from "@/lib/contracts/community";

const safeMember = {
  current_streak: 3,
  display_name: "Beatriz",
  joined_at: "2026-07-30T12:00:00Z",
  seven_day_average_ml: 2395,
  seven_day_eligible_days: 7,
  seven_day_goal_days: 5,
  today_goal_ml: 2957,
  today_intake_ml: 2129,
  username: "beatriz",
};

describe("Community contracts", () => {
  it("normalizes validated membership input", () => {
    expect(
      communityProfileInputSchema.parse({
        isVisible: true,
        username: "  Hector.Ferronato ",
      }),
    ).toEqual({
      isVisible: true,
      username: "hector.ferronato",
    });
  });

  it("rejects an aggregate response containing private fields", () => {
    expect(() =>
      communityDirectorySchema.parse({
        members: [
          {
            ...safeMember,
            email: "must-not-be-forwarded@example.com",
            timezone: "America/New_York",
            user_id: "internal-id",
          },
        ],
      }),
    ).toThrow();
  });

  it("parses only the safe member presentation model", () => {
    const [member] = communityDirectorySchema.parse({
      members: [
        {
          ...safeMember,
        },
      ],
    });

    expect(member).toEqual({
      completedBottlesThisWeek: null,
      currentStreak: 3,
      daily: [],
      displayName: "Beatriz",
      joinedAt: "2026-07-30T12:00:00Z",
      sevenDayAverageMl: 2395,
      sevenDayEligibleDays: 7,
      sevenDayGoalDays: 5,
      todayGoalMl: 2957,
      todayIntakeMl: 2129,
      username: "beatriz",
    });
  });

  it("maps unknown, hidden, former, and invalid members to one result", () => {
    expect(
      communityMemberResultSchema.parse({
        error_code: "COMMUNITY_MEMBER_UNAVAILABLE",
      }),
    ).toBeNull();
  });

  it("creates supportive initials without exposing account data", () => {
    expect(getCommunityInitials("Hector Ferronato")).toBe("HF");
    expect(getCommunityInitials("Beatriz")).toBe("B");
    expect(getCommunityInitials("")).toBe("HP");
  });

  it("renders authoritative milliliters in the viewer's selected unit", () => {
    expect(formatCommunityVolume(2957, "oz")).toBe("100 oz");
    expect(formatCommunityVolume(2957, "ml")).toBe("2957 ml");
    expect(getCommunityGoalPercentage(2129, 2957)).toBe(72);
    expect(getCommunityGoalPercentage(2129, null)).toBeNull();
  });

  it("filters the bounded directory by name and username case-insensitively", () => {
    const members = [
      { displayName: "Beatriz Teixeira", username: "beatriz" },
      { displayName: "Hector Ferronato", username: "hector.ferronato" },
    ];

    expect(filterCommunityMembers(members, "BEA")).toEqual([members[0]]);
    expect(filterCommunityMembers(members, "ferronato")).toEqual([members[1]]);
    expect(filterCommunityMembers(members, "unknown")).toEqual([]);
  });
});

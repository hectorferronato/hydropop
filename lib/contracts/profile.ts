import type { VolumeUnit } from "@/lib/units/volume";

export type PrivateProfileSummary = {
  activeDayCount: number;
  averageDailyIntakeMl: number | null;
  bestGoalStreak: number;
  currentGoalStreak: number;
  daysGoalMet: number;
  displayName: string | null;
  initials: string;
  lifetimeHydrationMl: number;
  memberSince: string | null;
  preferredUnit: VolumeUnit;
  timezone: string;
  totalCompletedBottles: number;
};

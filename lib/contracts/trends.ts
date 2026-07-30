import type { VolumeUnit } from "@/lib/units/volume";

export const trendRanges = [7, 30, 90] as const;

export type TrendRange = (typeof trendRanges)[number];

export type TrendDay = {
  change: {
    absoluteMl: number;
    percentage: number | null;
  } | null;
  date: string;
  goalMet: boolean;
  goalMl: number | null;
  intakeMl: number;
};

export type TrendTimeBlock = "afternoon" | "evening" | "morning" | "night";

export type RollingAveragePoint = {
  averageIntakeMl: number;
  date: string;
  daysUsed: number;
  goalMl: number | null;
  status: "above" | "below" | "near" | null;
};

export type TrendsSummary = {
  bestGoalStreak: number;
  completionTiming: {
    blocks: Record<TrendTimeBlock, number>;
    sampleCount: number;
    typicalTimeMinutes: number | null;
  };
  currentDate: string;
  currentGoalStreak: number;
  days: TrendDay[];
  goalRate: {
    eligibleDays: number;
    metDays: number;
    percentage: number | null;
  };
  hasHydrationEvents: boolean;
  hasHydrationHistory: boolean;
  preferredUnit: VolumeUnit;
  range: TrendRange;
  rollingAverage: RollingAveragePoint[];
  startDate: string | null;
  timezone: string;
};

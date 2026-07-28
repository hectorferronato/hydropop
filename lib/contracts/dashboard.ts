import type { HydrationCoaching } from "@/lib/domain/coaching/coaching";
import type { HydrationDaySummary } from "@/lib/domain/hydration/daily-summary";
import type { HydrationTimelineEvent } from "@/lib/domain/hydration/event-types";
import type { VolumeUnit } from "@/lib/units/volume";

export type TodayDashboard = {
  activeBottle: {
    activeCycle: boolean;
    capacityMl: number;
    id: string;
    name: string;
    startedAt: string | null;
  } | null;
  coaching: HydrationCoaching;
  currentStreak: number;
  date: string;
  daySummary: HydrationDaySummary;
  latestEffectiveEvent: HydrationTimelineEvent | null;
  preferredUnit: VolumeUnit;
  profile: {
    displayName: string | null;
    timezone: string;
  };
};

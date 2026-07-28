import type { HydrationDaySummary } from "@/lib/domain/hydration/daily-summary";
import type { VolumeUnit } from "@/lib/units/volume";

export type CalendarSummary = {
  days: HydrationDaySummary[];
  month: string;
  preferredUnit: VolumeUnit;
  timezone: string;
};

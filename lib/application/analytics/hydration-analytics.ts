import { getGoalForDate } from "@/lib/application/hydration/hydration-projection";
import type { PrivateProfileSummary } from "@/lib/contracts/profile";
import {
  trendRanges,
  type RollingAveragePoint,
  type TrendDay,
  type TrendRange,
  type TrendsSummary,
  type TrendTimeBlock,
} from "@/lib/contracts/trends";
import { summarizeHydrationDay } from "@/lib/domain/hydration/daily-summary";
import { reconstructEffectiveEvents } from "@/lib/domain/hydration/effective-events";
import {
  addDaysToDate,
  getDateInTimezone,
  getLocalTimeInTimezone,
} from "@/lib/domain/hydration/hydration-day";
import { calculateCurrentStreak } from "@/lib/domain/hydration/streaks";
import type {
  HydrationGoal,
  HydrationSnapshot,
} from "@/lib/infrastructure/supabase/hydration";
import { parseVolumeUnit } from "@/lib/units/volume";

type AnalyticsDay = {
  date: string;
  goalMl: number | null;
  intakeMl: number;
};

function earlierDate(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left < right ? left : right;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDaysToDate(cursor, 1);
  }

  return dates;
}

function firstGoalDate(
  goals: readonly HydrationGoal[],
  currentDate: string,
): string | null {
  return (
    [...goals]
      .filter((goal) => goal.effective_from <= currentDate)
      .sort((left, right) =>
        left.effective_from.localeCompare(right.effective_from),
      )[0]?.effective_from ?? null
  );
}

function calculateBestStreak(days: readonly AnalyticsDay[]): number {
  let best = 0;
  let current = 0;

  for (const day of days) {
    if (day.goalMl !== null && day.intakeMl >= day.goalMl) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

function completionTimeBlock(minutes: number): TrendTimeBlock {
  const hour = Math.floor(minutes / 60);

  if (hour >= 5 && hour < 12) {
    return "morning";
  }

  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }

  if (hour >= 17 && hour < 21) {
    return "evening";
  }

  return "night";
}

export function calculateCircularTimeMinutes(
  timesInMinutes: readonly number[],
): number | null {
  if (timesInMinutes.length < 3) {
    return null;
  }

  const radians = timesInMinutes.map(
    (minutes) => (minutes / 1_440) * Math.PI * 2,
  );
  const meanSine =
    radians.reduce((total, angle) => total + Math.sin(angle), 0) /
    radians.length;
  const meanCosine =
    radians.reduce((total, angle) => total + Math.cos(angle), 0) /
    radians.length;
  const concentration = Math.hypot(meanSine, meanCosine);

  if (concentration < 0.15) {
    return null;
  }

  const angle = Math.atan2(meanSine, meanCosine);
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle;

  return Math.round((normalized / (Math.PI * 2)) * 1_440) % 1_440;
}

function rollingStatus(
  averageIntakeMl: number,
  averageGoalMl: number | null,
): RollingAveragePoint["status"] {
  if (!averageGoalMl) {
    return null;
  }

  const ratio = averageIntakeMl / averageGoalMl;

  if (ratio > 1.05) {
    return "above";
  }

  if (ratio >= 0.9) {
    return "near";
  }

  return "below";
}

function buildAnalyticsDays({
  currentDate,
  snapshot,
  startDate,
  timezone,
}: {
  currentDate: string;
  snapshot: HydrationSnapshot;
  startDate: string;
  timezone: string;
}): AnalyticsDay[] {
  const history = reconstructEffectiveEvents(snapshot.events);

  return enumerateDates(startDate, currentDate).map((date) => {
    const goal = getGoalForDate(snapshot.goals, date);
    const summary = summarizeHydrationDay({
      date,
      goalMl: goal?.daily_goal_ml ?? null,
      timeline: history.timeline,
      timezone,
    });

    return {
      date,
      goalMl: summary.goalMl,
      intakeMl: summary.consumedMl,
    };
  });
}

export function parseTrendRange(value: unknown): TrendRange {
  const parsed =
    typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : null;

  return trendRanges.find((range) => range === parsed) ?? 30;
}

export function buildTrendsSummary(
  snapshot: HydrationSnapshot,
  requestedRange: TrendRange,
  now = new Date(),
): TrendsSummary {
  const timezone = snapshot.profile?.timezone ?? "America/New_York";
  const currentDate = getDateInTimezone(timezone, now);
  const boundedSnapshot: HydrationSnapshot = {
    ...snapshot,
    events: snapshot.events.filter(
      (event) => Date.parse(event.occurredAt) <= now.getTime(),
    ),
  };
  const history = reconstructEffectiveEvents(boundedSnapshot.events);
  const effectiveThroughNow = history.effectiveEvents;
  const firstEventDate =
    effectiveThroughNow
      .map((event) => getDateInTimezone(timezone, new Date(event.occurredAt)))
      .sort()[0] ?? null;
  const firstRelevantDate = earlierDate(
    firstEventDate,
    firstGoalDate(snapshot.goals, currentDate),
  );
  const requestedStart = addDaysToDate(currentDate, -(requestedRange - 1));
  const startDate =
    firstRelevantDate && firstRelevantDate > requestedStart
      ? firstRelevantDate
      : firstRelevantDate
        ? requestedStart
        : null;
  const allDays = firstRelevantDate
    ? buildAnalyticsDays({
        currentDate,
        snapshot: boundedSnapshot,
        startDate: firstRelevantDate,
        timezone,
      })
    : [];
  const selectedBaseDays = startDate
    ? allDays.filter((day) => day.date >= startDate)
    : [];
  const days: TrendDay[] = selectedBaseDays.map((day, index) => {
    const previous = selectedBaseDays[index - 1];
    const absoluteMl = previous ? day.intakeMl - previous.intakeMl : null;

    return {
      change:
        absoluteMl === null
          ? null
          : {
              absoluteMl,
              percentage:
                previous && previous.intakeMl > 0
                  ? Math.round((absoluteMl / previous.intakeMl) * 100)
                  : null,
            },
      date: day.date,
      goalMet: day.goalMl !== null && day.intakeMl >= day.goalMl,
      goalMl: day.goalMl,
      intakeMl: day.intakeMl,
    };
  });
  const eligibleGoalDays = days.filter((day) => day.goalMl !== null);
  const metGoalDays = eligibleGoalDays.filter((day) => day.goalMet);
  const streakDays = allDays.map((day) => ({
    date: day.date,
    goalMl: day.goalMl,
    intakeMl: day.intakeMl,
  }));
  const completionTimes = effectiveThroughNow
    .filter(
      (event) =>
        event.eventType === "bottle_completed" &&
        (!startDate ||
          getDateInTimezone(timezone, new Date(event.occurredAt)) >= startDate),
    )
    .map((event) => {
      const [hour, minute] = getLocalTimeInTimezone(
        timezone,
        new Date(event.occurredAt),
      )
        .split(":")
        .map(Number);

      return (hour ?? 0) * 60 + (minute ?? 0);
    });
  const blocks: Record<TrendTimeBlock, number> = {
    afternoon: 0,
    evening: 0,
    morning: 0,
    night: 0,
  };

  for (const completionTime of completionTimes) {
    blocks[completionTimeBlock(completionTime)] += 1;
  }

  const rollingAverage = days.map<RollingAveragePoint>((day) => {
    const allDayIndex = allDays.findIndex((item) => item.date === day.date);
    const window = allDays.slice(Math.max(0, allDayIndex - 6), allDayIndex + 1);
    const averageIntakeMl = Math.round(
      window.reduce((total, item) => total + item.intakeMl, 0) / window.length,
    );

    return {
      averageIntakeMl,
      date: day.date,
      daysUsed: window.length,
      goalMl: day.goalMl,
      status: rollingStatus(averageIntakeMl, day.goalMl),
    };
  });
  const selectedEventDates = new Set(days.map((day) => day.date));
  const hasHydrationEvents = effectiveThroughNow.some(
    (event) =>
      event.creditedVolumeMl !== 0 &&
      selectedEventDates.has(
        getDateInTimezone(timezone, new Date(event.occurredAt)),
      ),
  );

  return {
    bestGoalStreak: calculateBestStreak(allDays),
    completionTiming: {
      blocks,
      sampleCount: completionTimes.length,
      typicalTimeMinutes: calculateCircularTimeMinutes(completionTimes),
    },
    currentDate,
    currentGoalStreak: calculateCurrentStreak(streakDays, currentDate),
    days,
    goalRate: {
      eligibleDays: eligibleGoalDays.length,
      metDays: metGoalDays.length,
      percentage:
        eligibleGoalDays.length > 0
          ? Math.round((metGoalDays.length / eligibleGoalDays.length) * 100)
          : null,
    },
    hasHydrationEvents,
    hasHydrationHistory: effectiveThroughNow.some(
      (event) => event.creditedVolumeMl !== 0,
    ),
    preferredUnit: parseVolumeUnit(snapshot.profile?.preferred_unit),
    range: requestedRange,
    rollingAverage,
    startDate,
    timezone,
  };
}

export function profileInitials(displayName: string | null): string {
  const initials = displayName
    ?.trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "HP";
}

export function buildPrivateProfileSummary(
  snapshot: HydrationSnapshot,
  now = new Date(),
): PrivateProfileSummary {
  const timezone = snapshot.profile?.timezone ?? "America/New_York";
  const currentDate = getDateInTimezone(timezone, now);
  const boundedSnapshot: HydrationSnapshot = {
    ...snapshot,
    events: snapshot.events.filter(
      (event) => Date.parse(event.occurredAt) <= now.getTime(),
    ),
  };
  const history = reconstructEffectiveEvents(boundedSnapshot.events);
  const effectiveThroughNow = history.effectiveEvents;
  const firstHydrationDate =
    effectiveThroughNow
      .filter((event) => event.creditedVolumeMl !== 0)
      .map((event) => getDateInTimezone(timezone, new Date(event.occurredAt)))
      .sort()[0] ?? null;
  const firstRelevantDate = earlierDate(
    firstHydrationDate,
    firstGoalDate(snapshot.goals, currentDate),
  );
  const goalDays = firstRelevantDate
    ? buildAnalyticsDays({
        currentDate,
        snapshot: boundedSnapshot,
        startDate: firstRelevantDate,
        timezone,
      })
    : [];
  const hydrationDays = firstHydrationDate
    ? buildAnalyticsDays({
        currentDate,
        snapshot: boundedSnapshot,
        startDate: firstHydrationDate,
        timezone,
      })
    : [];
  const lifetimeHydrationMl = hydrationDays.reduce(
    (total, day) => total + day.intakeMl,
    0,
  );

  return {
    activeDayCount: hydrationDays.length,
    averageDailyIntakeMl:
      hydrationDays.length > 0
        ? Math.round(lifetimeHydrationMl / hydrationDays.length)
        : null,
    bestGoalStreak: calculateBestStreak(goalDays),
    currentGoalStreak: calculateCurrentStreak(goalDays, currentDate),
    daysGoalMet: goalDays.filter(
      (day) => day.goalMl !== null && day.intakeMl >= day.goalMl,
    ).length,
    displayName: snapshot.profile?.display_name ?? null,
    initials: profileInitials(snapshot.profile?.display_name ?? null),
    lifetimeHydrationMl,
    memberSince: snapshot.profile?.created_at ?? null,
    preferredUnit: parseVolumeUnit(snapshot.profile?.preferred_unit),
    timezone,
    totalCompletedBottles: effectiveThroughNow.filter(
      (event) => event.eventType === "bottle_completed",
    ).length,
  };
}

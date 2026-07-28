import type { CalendarSummary } from "@/lib/contracts/calendar";
import type { TodayDashboard } from "@/lib/contracts/dashboard";
import { calculateHydrationCoaching } from "@/lib/domain/coaching/coaching";
import { reconstructBottleCycle } from "@/lib/domain/hydration/bottle-cycle";
import { summarizeHydrationDay } from "@/lib/domain/hydration/daily-summary";
import { reconstructEffectiveEvents } from "@/lib/domain/hydration/effective-events";
import {
  addDaysToDate,
  getDateInTimezone,
} from "@/lib/domain/hydration/hydration-day";
import { calculateCurrentStreak } from "@/lib/domain/hydration/streaks";
import type {
  HydrationGoal,
  HydrationSnapshot,
} from "@/lib/infrastructure/supabase/hydration";
import { parseVolumeUnit } from "@/lib/units/volume";

export function getGoalForDate(
  goals: readonly HydrationGoal[],
  date: string,
): HydrationGoal | null {
  return (
    [...goals]
      .filter(
        (goal) =>
          goal.effective_from <= date &&
          (!goal.effective_until || goal.effective_until >= date),
      )
      .sort(
        (left, right) =>
          right.effective_from.localeCompare(left.effective_from) ||
          right.created_at.localeCompare(left.created_at) ||
          left.id.localeCompare(right.id),
      )[0] ?? null
  );
}

function buildStreakDays(
  snapshot: HydrationSnapshot,
  currentDate: string,
  timezone: string,
) {
  const history = reconstructEffectiveEvents(snapshot.events);
  const firstGoalDate = [...snapshot.goals]
    .sort((left, right) =>
      left.effective_from.localeCompare(right.effective_from),
    )
    .at(0)?.effective_from;

  if (!firstGoalDate) {
    return [];
  }

  const days = [];
  let cursor = firstGoalDate;

  while (cursor <= currentDate) {
    const goal = getGoalForDate(snapshot.goals, cursor);
    const summary = summarizeHydrationDay({
      date: cursor,
      goalMl: goal?.daily_goal_ml ?? null,
      timeline: history.timeline,
      timezone,
    });
    days.push({
      date: cursor,
      goalMl: goal?.daily_goal_ml ?? null,
      intakeMl: summary.consumedMl,
    });
    cursor = addDaysToDate(cursor, 1);
  }

  return days;
}

export function buildTodayDashboard(
  snapshot: HydrationSnapshot,
  now = new Date(),
): TodayDashboard {
  const timezone = snapshot.profile?.timezone ?? "America/New_York";
  const date = getDateInTimezone(timezone, now);
  const goal = getGoalForDate(snapshot.goals, date);
  const history = reconstructEffectiveEvents(snapshot.events);
  const eventsThroughNow = history.effectiveEvents.filter(
    (event) => Date.parse(event.occurredAt) <= now.getTime(),
  );
  const cycle = reconstructBottleCycle(
    eventsThroughNow,
    snapshot.primaryBottle?.id,
  );
  const daySummary = summarizeHydrationDay({
    date,
    goalMl: goal?.daily_goal_ml ?? null,
    timeline: history.timeline,
    timezone,
  });
  const coaching = calculateHydrationCoaching({
    bottleCapacityMl: snapshot.primaryBottle?.capacity_ml ?? null,
    consumedMl: daySummary.consumedMl,
    date,
    goalMl: goal?.daily_goal_ml ?? null,
    now,
    targetCompletionTime:
      goal?.target_completion_time ??
      snapshot.profile?.target_completion_time ??
      null,
    timezone,
    wakeTime: snapshot.profile?.wake_time ?? null,
  });

  return {
    activeBottle: snapshot.primaryBottle
      ? {
          activeCycle: cycle.active,
          capacityMl: snapshot.primaryBottle.capacity_ml,
          id: snapshot.primaryBottle.id,
          name: snapshot.primaryBottle.name,
          startedAt: cycle.startedAt,
        }
      : null,
    coaching,
    currentStreak: calculateCurrentStreak(
      buildStreakDays(snapshot, date, timezone),
      date,
    ),
    date,
    daySummary,
    latestEffectiveEvent: eventsThroughNow.at(-1) ?? null,
    preferredUnit: parseVolumeUnit(snapshot.profile?.preferred_unit),
    profile: {
      displayName: snapshot.profile?.display_name ?? null,
      timezone,
    },
  };
}

export function buildCalendarSummary(
  snapshot: HydrationSnapshot,
  month: string,
): CalendarSummary {
  const timezone = snapshot.profile?.timezone ?? "America/New_York";
  const history = reconstructEffectiveEvents(snapshot.events);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const numberOfDays = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const days = Array.from({ length: numberOfDays }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const goal = getGoalForDate(snapshot.goals, date);

    return summarizeHydrationDay({
      date,
      goalMl: goal?.daily_goal_ml ?? null,
      timeline: history.timeline,
      timezone,
    });
  });

  return {
    days,
    month,
    preferredUnit: parseVolumeUnit(snapshot.profile?.preferred_unit),
    timezone,
  };
}

import { addDaysToDate } from "./hydration-day";

export type StreakDay = {
  date: string;
  goalMl: number | null;
  intakeMl: number;
};

export function calculateCurrentStreak(
  days: readonly StreakDay[],
  currentDate: string,
): number {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const current = byDate.get(currentDate);
  let cursor =
    current?.goalMl && current.intakeMl >= current.goalMl
      ? currentDate
      : addDaysToDate(currentDate, -1);
  let streak = 0;

  while (true) {
    const day = byDate.get(cursor);

    if (!day?.goalMl || day.intakeMl < day.goalMl) {
      return streak;
    }

    streak += 1;
    cursor = addDaysToDate(cursor, -1);
  }
}

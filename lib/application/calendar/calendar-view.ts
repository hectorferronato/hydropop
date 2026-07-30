import type { HydrationDaySummary } from "@/lib/domain/hydration/daily-summary";

export type CalendarWeek = Array<HydrationDaySummary | null>;

export function buildCalendarWeeks(
  month: string,
  days: readonly HydrationDaySummary[],
): CalendarWeek[] {
  const firstWeekday = new Date(`${month}-01T00:00:00.000Z`).getUTCDay();
  const cells: Array<HydrationDaySummary | null> = [
    ...Array.from<null>({ length: firstWeekday }).fill(null),
    ...days,
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
}

export function getCurrentWeekIndex(
  month: string,
  currentDate: string,
): number | null {
  if (!currentDate.startsWith(`${month}-`)) {
    return null;
  }

  const day = Number(currentDate.slice(-2));
  const firstWeekday = new Date(`${month}-01T00:00:00.000Z`).getUTCDay();

  if (!Number.isInteger(day) || day < 1) {
    return null;
  }

  return Math.floor((firstWeekday + day - 1) / 7);
}

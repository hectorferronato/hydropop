import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

export type ChartLabelDensity = "compact" | "comfortable";

function dateFromLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function formatChartDateLabel(
  date: string,
  currentDate: string,
  totalPoints: number,
): string {
  if (date === currentDate) {
    return "Today";
  }

  return new Intl.DateTimeFormat("en-US", {
    ...(totalPoints <= 7
      ? { weekday: "short" as const }
      : { day: "numeric" as const, month: "short" as const }),
    timeZone: "UTC",
  }).format(dateFromLocalDate(date));
}

export function formatAccessibleChartDate(
  date: string,
  currentDate: string,
): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(dateFromLocalDate(date));

  return date === currentDate ? `${formatted} (today)` : formatted;
}

export function formatChartValueLabel(
  volumeMl: number,
  unit: VolumeUnit,
  perDay = false,
): string {
  return `${formatDisplayVolume(volumeMl, unit)} ${unit}${perDay ? "/day" : ""}`;
}

export function formatChartGoalLabel(
  goalMl: number,
  unit: VolumeUnit,
  perDay = false,
): string {
  return `Goal ${formatChartValueLabel(goalMl, unit, perDay)}`;
}

export function shouldShowChartDateLabel({
  density,
  index,
  isToday,
  totalPoints,
}: {
  density: ChartLabelDensity;
  index: number;
  isToday: boolean;
  totalPoints: number;
}): boolean {
  if (totalPoints <= 7 || index === 0 || index === totalPoints - 1 || isToday) {
    return true;
  }

  const interval =
    density === "compact"
      ? totalPoints <= 30
        ? 7
        : 30
      : totalPoints <= 30
        ? 5
        : 15;

  return index % interval === 0;
}

export function getGoalChangeIndices(
  goals: readonly (number | null)[],
): number[] {
  return goals.flatMap((goal, index) => {
    if (goal === null) {
      return [];
    }

    return index === 0 || goals[index - 1] !== goal ? [index] : [];
  });
}

export function getPriorityValueIndices(
  values: readonly number[],
  density: ChartLabelDensity,
): number[] {
  if (values.length === 0) {
    return [];
  }

  if (values.length <= 7) {
    return values.map((_, index) => index);
  }

  const latestIndex = values.length - 1;
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  const interval =
    density === "compact"
      ? values.length <= 30
        ? 7
        : 30
      : values.length <= 30
        ? 5
        : 15;
  const indices = new Set<number>([
    0,
    latestIndex,
    values.indexOf(maximum),
    values.indexOf(minimum),
  ]);

  values.forEach((_, index) => {
    if (index % interval === 0) {
      indices.add(index);
    }
  });

  return [...indices].sort((left, right) => left - right);
}

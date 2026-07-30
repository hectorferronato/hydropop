import {
  formatAccessibleChartDate,
  formatChartDateLabel,
  formatChartGoalLabel,
  formatChartValueLabel,
  getGoalChangeIndices,
  getPriorityValueIndices,
  shouldShowChartDateLabel,
  type ChartLabelDensity,
} from "@/lib/application/analytics/chart-presentation";
import type {
  RollingAveragePoint,
  TrendDay,
  TrendTimeBlock,
} from "@/lib/contracts/trends";
import type { VolumeUnit } from "@/lib/units/volume";

const compactChartWidth = 320;
const comfortableChartWidth = 640;
const chartHeight = 276;
const chartBottom = 220;
const chartTop = 42;
const chartDateLabelY = 252;
const chartSidePadding = 14;

function chartY(value: number, maximum: number): number {
  return chartBottom - (value / maximum) * (chartBottom - chartTop);
}

function chartTextAnchor(
  index: number,
  totalPoints: number,
): "end" | "middle" | "start" {
  if (index === 0) {
    return "start";
  }

  if (index === totalPoints - 1) {
    return "end";
  }

  return "middle";
}

function valueLabelY(valueY: number, index: number): number {
  return Math.max(17 + (index % 2) * 13, valueY - 8 - (index % 2) * 13);
}

function goalLabelY(goalY: number): number {
  return goalY > chartBottom - 22 ? goalY - 8 : goalY + 15;
}

function DailyIntakeSvg({
  className,
  currentDate,
  days,
  density,
  unit,
  width,
}: {
  className: string;
  currentDate: string;
  days: TrendDay[];
  density: ChartLabelDensity;
  unit: VolumeUnit;
  width: number;
}) {
  const maximum = Math.max(
    1,
    ...days.flatMap((day) => [day.intakeMl, day.goalMl ?? 0]),
  );
  const slotWidth = width / days.length;
  const barWidth = Math.max(2, Math.min(44, slotWidth * 0.58));
  const valueLabelIndices = new Set(
    getPriorityValueIndices(
      days.map((day) => day.intakeMl),
      density,
    ),
  );
  const goalLabelIndices = new Set(
    getGoalChangeIndices(days.map((day) => day.goalMl)),
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${chartHeight}`}
      role="img"
      aria-label={`Daily hydration intake for ${days.length} local days`}
      aria-describedby="daily-intake-chart-description"
      className={className}
    >
      <title>
        Daily intake bars with date, value, and applicable-goal labels
      </title>
      <line
        x1="0"
        y1={chartBottom}
        x2={width}
        y2={chartBottom}
        className="stroke-brand-secondary/10"
      />
      {days.map((day, index) => {
        const center = slotWidth * index + slotWidth / 2;
        const intakeY = chartY(day.intakeMl, maximum);
        const goalY = day.goalMl === null ? null : chartY(day.goalMl, maximum);
        const showDate = shouldShowChartDateLabel({
          density,
          index,
          isToday: day.date === currentDate,
          totalPoints: days.length,
        });

        return (
          <g key={day.date} data-chart-day={day.date}>
            <rect
              x={center - barWidth / 2}
              y={intakeY}
              width={barWidth}
              height={Math.max(1, chartBottom - intakeY)}
              rx={Math.min(5, barWidth / 2)}
              className="fill-brand-primary/75"
            >
              <title>{`${formatAccessibleChartDate(
                day.date,
                currentDate,
              )}: ${formatChartValueLabel(day.intakeMl, unit)}`}</title>
            </rect>
            {goalY === null ? null : (
              <line
                x1={center - barWidth / 2 - 1}
                x2={center + barWidth / 2 + 1}
                y1={goalY}
                y2={goalY}
                className="stroke-brand-secondary"
                strokeWidth="2"
              >
                <title>{formatChartGoalLabel(day.goalMl ?? 0, unit)}</title>
              </line>
            )}
            {valueLabelIndices.has(index) ? (
              <text
                x={center}
                y={valueLabelY(intakeY, index)}
                textAnchor="middle"
                className="fill-brand-secondary text-[11px] font-bold"
              >
                {formatChartValueLabel(day.intakeMl, unit)}
              </text>
            ) : null}
            {goalY !== null && goalLabelIndices.has(index) ? (
              <text
                x={center}
                y={goalLabelY(goalY)}
                textAnchor={chartTextAnchor(index, days.length)}
                className="fill-brand-secondary stroke-white [stroke-width:3px] text-[10px] font-bold [paint-order:stroke]"
              >
                {formatChartGoalLabel(day.goalMl ?? 0, unit)}
              </text>
            ) : null}
            {showDate ? (
              <text
                x={center}
                y={chartDateLabelY}
                textAnchor={chartTextAnchor(index, days.length)}
                className={`text-[11px] font-semibold ${
                  day.date === currentDate
                    ? "fill-brand-primary"
                    : "fill-brand-secondary/55"
                }`}
              >
                {formatChartDateLabel(day.date, currentDate, days.length)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function DailyIntakeChart({
  currentDate,
  days,
  unit,
}: {
  currentDate: string;
  days: TrendDay[];
  unit: VolumeUnit;
}) {
  return (
    <figure className="mt-5 min-w-0">
      <p id="daily-intake-chart-description" className="sr-only">
        Bars show projected intake for each profile-local date. Short ranges
        label every date and value; longer ranges reduce visible labels while
        retaining every bar and every row in the following data table. Goal
        segments and labels use the goal effective on each date.
      </p>
      <DailyIntakeSvg
        className="mx-auto h-auto w-full max-w-[20rem] overflow-visible sm:hidden"
        currentDate={currentDate}
        days={days}
        density="compact"
        unit={unit}
        width={compactChartWidth}
      />
      <DailyIntakeSvg
        className="mx-auto hidden h-auto w-full max-w-[40rem] overflow-visible sm:block"
        currentDate={currentDate}
        days={days}
        density="comfortable"
        unit={unit}
        width={comfortableChartWidth}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.68rem] font-semibold">
        <span className="text-brand-primary flex items-center gap-1.5">
          <span className="bg-brand-primary size-2.5 rounded-sm" />
          Intake
        </span>
        <span className="text-brand-secondary/55 flex items-center gap-1.5">
          <span className="bg-brand-secondary h-0.5 w-3" />
          Applicable goal; labels mark goal changes
        </span>
      </div>
      <table className="sr-only">
        <caption>Daily hydration intake and applicable goals</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Intake</th>
            <th>Goal</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{formatAccessibleChartDate(day.date, currentDate)}</td>
              <td>{formatChartValueLabel(day.intakeMl, unit)}</td>
              <td>
                {day.goalMl === null
                  ? "No goal"
                  : formatChartGoalLabel(day.goalMl, unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function buildSteppedGoalPaths({
  maximum,
  pointX,
  points,
}: {
  maximum: number;
  pointX: (index: number) => number;
  points: RollingAveragePoint[];
}): string[] {
  const paths: string[] = [];
  let currentPath = "";
  let previousGoal: number | null = null;

  points.forEach((point, index) => {
    if (point.goalMl === null) {
      if (currentPath) {
        paths.push(currentPath);
      }
      currentPath = "";
      previousGoal = null;
      return;
    }

    const x = pointX(index);
    const y = chartY(point.goalMl, maximum);

    if (!currentPath || previousGoal === null) {
      currentPath = `M ${x} ${y}`;
    } else {
      currentPath += ` H ${x} V ${y}`;
    }

    previousGoal = point.goalMl;
  });

  if (currentPath) {
    paths.push(currentPath);
  }

  return paths;
}

function RollingAverageSvg({
  className,
  currentDate,
  density,
  points,
  unit,
  width,
}: {
  className: string;
  currentDate: string;
  density: ChartLabelDensity;
  points: RollingAveragePoint[];
  unit: VolumeUnit;
  width: number;
}) {
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.averageIntakeMl, point.goalMl ?? 0]),
  );
  const pointX = (index: number) =>
    points.length === 1
      ? width / 2
      : chartSidePadding +
        (index / (points.length - 1)) * (width - chartSidePadding * 2);
  const intakePoints = points
    .map(
      (point, index) =>
        `${pointX(index)},${chartY(point.averageIntakeMl, maximum)}`,
    )
    .join(" ");
  const goalPaths = buildSteppedGoalPaths({ maximum, pointX, points });
  const valueLabelIndices = new Set(
    getPriorityValueIndices(
      points.map((point) => point.averageIntakeMl),
      density,
    ),
  );
  const goalLabelIndices = new Set(
    getGoalChangeIndices(points.map((point) => point.goalMl)),
  );
  const latestIndex = points.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${chartHeight}`}
      role="img"
      aria-label="Rolling average hydration compared with date-effective goals"
      aria-describedby="rolling-average-chart-description"
      className={className}
    >
      <title>
        Rolling intake average with date, value, and stepped goal labels
      </title>
      <line
        x1={chartSidePadding}
        y1={chartBottom}
        x2={width - chartSidePadding}
        y2={chartBottom}
        className="stroke-brand-secondary/10"
      />
      {goalPaths.map((path, index) => (
        <path
          key={`${path}-${index}`}
          d={path}
          fill="none"
          className="stroke-brand-secondary/35"
          strokeDasharray="8 6"
          strokeWidth="3"
        />
      ))}
      <polyline
        points={intakePoints}
        fill="none"
        className="stroke-brand-primary"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      {points.map((point, index) => {
        const x = pointX(index);
        const y = chartY(point.averageIntakeMl, maximum);
        const isLatest = index === latestIndex;
        const showDate = shouldShowChartDateLabel({
          density,
          index,
          isToday: point.date === currentDate,
          totalPoints: points.length,
        });

        return (
          <g key={point.date} data-rolling-point={point.date}>
            {point.goalMl === null ? null : (
              <line
                x1={Math.max(chartSidePadding, x - 5)}
                x2={Math.min(width - chartSidePadding, x + 5)}
                y1={chartY(point.goalMl, maximum)}
                y2={chartY(point.goalMl, maximum)}
                className="stroke-brand-secondary/35"
                strokeWidth="3"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={isLatest ? "6" : "4"}
              data-latest-point={isLatest ? "true" : undefined}
              className={`stroke-brand-primary ${
                isLatest ? "fill-brand-primary" : "fill-white"
              }`}
              strokeWidth="3"
            >
              <title>{`${formatAccessibleChartDate(
                point.date,
                currentDate,
              )}: ${formatChartValueLabel(
                point.averageIntakeMl,
                unit,
                true,
              )}, based on ${point.daysUsed} day${
                point.daysUsed === 1 ? "" : "s"
              }`}</title>
            </circle>
            {valueLabelIndices.has(index) ? (
              <text
                x={x}
                y={valueLabelY(y, index)}
                textAnchor={chartTextAnchor(index, points.length)}
                className={`text-[11px] font-bold ${
                  isLatest ? "fill-brand-primary" : "fill-brand-secondary"
                }`}
              >
                {formatChartValueLabel(point.averageIntakeMl, unit)}
              </text>
            ) : null}
            {point.goalMl !== null && goalLabelIndices.has(index) ? (
              <text
                x={x}
                y={goalLabelY(chartY(point.goalMl, maximum))}
                textAnchor={chartTextAnchor(index, points.length)}
                className="fill-brand-secondary/70 stroke-white [stroke-width:3px] text-[10px] font-bold [paint-order:stroke]"
              >
                {formatChartGoalLabel(point.goalMl, unit, true)}
              </text>
            ) : null}
            {showDate ? (
              <text
                x={x}
                y={chartDateLabelY}
                textAnchor={chartTextAnchor(index, points.length)}
                className={`text-[11px] font-semibold ${
                  point.date === currentDate || isLatest
                    ? "fill-brand-primary"
                    : "fill-brand-secondary/55"
                }`}
              >
                {formatChartDateLabel(point.date, currentDate, points.length)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function RollingAverageChart({
  currentDate,
  points,
  unit,
}: {
  currentDate: string;
  points: RollingAveragePoint[];
  unit: VolumeUnit;
}) {
  return (
    <figure className="mt-5 min-w-0">
      <p id="rolling-average-chart-description" className="sr-only">
        The solid line shows the rolling intake average. The dashed stepped line
        follows the goal effective on each profile-local date. Short ranges
        label every point; longer ranges prioritize the latest, highest, lowest,
        and interval points while retaining every point in the data table.
      </p>
      <RollingAverageSvg
        className="mx-auto h-auto w-full max-w-[20rem] overflow-visible sm:hidden"
        currentDate={currentDate}
        density="compact"
        points={points}
        unit={unit}
        width={compactChartWidth}
      />
      <RollingAverageSvg
        className="mx-auto hidden h-auto w-full max-w-[40rem] overflow-visible sm:block"
        currentDate={currentDate}
        density="comfortable"
        points={points}
        unit={unit}
        width={comfortableChartWidth}
      />
      <table className="sr-only">
        <caption>Rolling average hydration and date-effective goals</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Average intake</th>
            <th>Days used</th>
            <th>Applicable goal</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{formatAccessibleChartDate(point.date, currentDate)}</td>
              <td>
                {formatChartValueLabel(point.averageIntakeMl, unit, true)}
              </td>
              <td>
                {point.daysUsed} day{point.daysUsed === 1 ? "" : "s"}
              </td>
              <td>
                {point.goalMl === null
                  ? "No goal"
                  : formatChartGoalLabel(point.goalMl, unit, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function CompletionTimeBlocks({
  blocks,
}: {
  blocks: Record<TrendTimeBlock, number>;
}) {
  const entries = (["morning", "afternoon", "evening", "night"] as const).map(
    (block) => ({ block, count: blocks[block] }),
  );
  const maximum = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    <div className="mt-5 grid gap-3">
      {entries.map(({ block, count }) => (
        <div key={block}>
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-brand-secondary capitalize">{block}</span>
            <span className="text-brand-secondary/45">
              {count} completion{count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="bg-brand-primary/8 mt-1.5 h-2 overflow-hidden rounded-full">
            <div
              className="bg-brand-primary h-full rounded-full"
              style={{ width: `${(count / maximum) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

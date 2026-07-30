import type {
  RollingAveragePoint,
  TrendDay,
  TrendTimeBlock,
} from "@/lib/contracts/trends";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

const chartWidth = 640;
const chartHeight = 220;
const chartBottom = 190;
const chartTop = 16;

function chartY(value: number, maximum: number): number {
  return chartBottom - (value / maximum) * (chartBottom - chartTop);
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function DailyIntakeChart({
  days,
  unit,
}: {
  days: TrendDay[];
  unit: VolumeUnit;
}) {
  const maximum = Math.max(
    1,
    ...days.flatMap((day) => [day.intakeMl, day.goalMl ?? 0]),
  );
  const slotWidth = chartWidth / days.length;
  const barWidth = Math.max(2, slotWidth * 0.58);

  return (
    <>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label={`Daily hydration intake for ${days.length} local days`}
        className="mt-5 h-auto w-full overflow-visible"
      >
        <title>
          Daily intake bars with a goal marker for each eligible day
        </title>
        <line
          x1="0"
          y1={chartBottom}
          x2={chartWidth}
          y2={chartBottom}
          className="stroke-brand-secondary/10"
        />
        {days.map((day, index) => {
          const center = slotWidth * index + slotWidth / 2;
          const intakeY = chartY(day.intakeMl, maximum);
          const goalY =
            day.goalMl === null ? null : chartY(day.goalMl, maximum);

          return (
            <g key={day.date}>
              <rect
                x={center - barWidth / 2}
                y={intakeY}
                width={barWidth}
                height={Math.max(1, chartBottom - intakeY)}
                rx={Math.min(5, barWidth / 2)}
                className="fill-brand-primary/75"
              >
                <title>
                  {shortDate(day.date)}:{" "}
                  {formatDisplayVolume(day.intakeMl, unit)} {unit}
                </title>
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
                  <title>
                    Goal: {formatDisplayVolume(day.goalMl ?? 0, unit)} {unit}
                  </title>
                </line>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[0.65rem] font-semibold">
        <span className="text-brand-primary flex items-center gap-1.5">
          <span className="bg-brand-primary size-2.5 rounded-sm" />
          Intake
        </span>
        <span className="text-brand-secondary/55 flex items-center gap-1.5">
          <span className="bg-brand-secondary h-0.5 w-3" />
          Applicable goal
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
              <td>{day.date}</td>
              <td>
                {formatDisplayVolume(day.intakeMl, unit)} {unit}
              </td>
              <td>
                {day.goalMl === null
                  ? "No goal"
                  : `${formatDisplayVolume(day.goalMl, unit)} ${unit}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function RollingAverageChart({
  points,
  unit,
}: {
  points: RollingAveragePoint[];
  unit: VolumeUnit;
}) {
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.averageIntakeMl, point.goalMl ?? 0]),
  );
  const pointX = (index: number) =>
    points.length === 1
      ? chartWidth / 2
      : (index / (points.length - 1)) * chartWidth;
  const intakePoints = points
    .map(
      (point, index) =>
        `${pointX(index)},${chartY(point.averageIntakeMl, maximum)}`,
    )
    .join(" ");
  const goalPoints = points
    .map((point, index) =>
      point.goalMl === null
        ? null
        : `${pointX(index)},${chartY(point.goalMl, maximum)}`,
    )
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Rolling average hydration compared with applicable goals"
        className="mt-5 h-auto w-full overflow-visible"
      >
        <title>
          Rolling intake average; early points use fewer than seven available
          local days
        </title>
        <line
          x1="0"
          y1={chartBottom}
          x2={chartWidth}
          y2={chartBottom}
          className="stroke-brand-secondary/10"
        />
        {goalPoints ? (
          <polyline
            points={goalPoints}
            fill="none"
            className="stroke-brand-secondary/35"
            strokeDasharray="8 6"
            strokeWidth="3"
          />
        ) : null}
        <polyline
          points={intakePoints}
          fill="none"
          className="stroke-brand-primary"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
        />
        {points.map((point, index) => (
          <circle
            key={point.date}
            cx={pointX(index)}
            cy={chartY(point.averageIntakeMl, maximum)}
            r="4"
            className="stroke-brand-primary fill-white"
            strokeWidth="3"
          >
            <title>
              {shortDate(point.date)}:{" "}
              {formatDisplayVolume(point.averageIntakeMl, unit)} {unit} per day,
              based on {point.daysUsed} day{point.daysUsed === 1 ? "" : "s"}
            </title>
          </circle>
        ))}
      </svg>
      <table className="sr-only">
        <caption>Rolling average hydration data</caption>
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
              <td>{point.date}</td>
              <td>
                {formatDisplayVolume(point.averageIntakeMl, unit)} {unit}
              </td>
              <td>{point.daysUsed}</td>
              <td>
                {point.goalMl === null
                  ? "No goal"
                  : `${formatDisplayVolume(point.goalMl, unit)} ${unit}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
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

import Link from "next/link";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import {
  buildTrendsSummary,
  parseTrendRange,
} from "@/lib/application/analytics/hydration-analytics";
import { trendRanges } from "@/lib/contracts/trends";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { formatDisplayVolume } from "@/lib/units/volume";

import {
  CompletionTimeBlocks,
  DailyIntakeChart,
  RollingAverageChart,
} from "./trend-charts";

function readParameter(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatClockMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  await connection();

  const user = await requireAllowedUser("/trends");
  const requestedRange = parseTrendRange(
    readParameter((await searchParams).range),
  );
  const trends = buildTrendsSummary(
    await getHydrationSnapshot(await createClient(), user.id),
    requestedRange,
    new Date(),
  );
  const latestDay = trends.days.at(-1);
  const latestRolling = trends.rollingAverage.at(-1);
  const unit = trends.preferredUnit;
  const change = latestDay?.change;

  return (
    <>
      <PageHeader
        eyebrow="Trends"
        title="Patterns from your hydration history"
        description="Local-day totals use immutable event snapshots, historical goals, and your profile timezone."
      />

      <nav
        aria-label="Trend range"
        className="mt-7 grid grid-cols-3 gap-2 rounded-2xl bg-white/75 p-1.5"
      >
        {trendRanges.map((range) => (
          <Link
            key={range}
            href={`/trends?range=${range}`}
            aria-current={trends.range === range ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-bold ${
              trends.range === range
                ? "bg-brand-primary text-white"
                : "text-brand-secondary/55 hover:bg-brand-primary/5"
            }`}
          >
            {range} days
          </Link>
        ))}
      </nav>

      {!trends.hasHydrationHistory || trends.days.length === 0 ? (
        <section className="border-brand-secondary/5 mt-7 rounded-[2rem] border bg-white/85 p-7 text-center">
          <h2 className="text-brand-secondary text-xl font-bold">
            Record your first bottle to start seeing trends
          </h2>
          <p className="text-brand-secondary/50 mx-auto mt-3 max-w-md text-sm leading-6">
            HydroPOP will show real patterns after you have hydration or goal
            history. No sample data is added.
          </p>
          <Link
            href="/today"
            className="bg-brand-primary mt-5 inline-flex h-11 items-center rounded-2xl px-5 text-sm font-bold text-white"
          >
            Go to Today
          </Link>
        </section>
      ) : !trends.hasHydrationEvents ? (
        <section className="border-brand-secondary/5 mt-7 rounded-[2rem] border bg-white/85 p-7 text-center">
          <h2 className="text-brand-secondary text-xl font-bold">
            No hydration recorded in this range
          </h2>
          <p className="text-brand-secondary/50 mx-auto mt-3 max-w-md text-sm leading-6">
            Choose a longer range to revisit earlier history, or record your
            next bottle from Today.
          </p>
          <Link
            href="/today"
            className="bg-brand-primary mt-5 inline-flex h-11 items-center rounded-2xl px-5 text-sm font-bold text-white"
          >
            Go to Today
          </Link>
        </section>
      ) : (
        <div className="mt-7 grid gap-5">
          <section className="border-brand-secondary/5 min-w-0 rounded-[2rem] border bg-white/90 p-5 sm:p-7">
            <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
              Daily intake
            </p>
            <h2 className="text-brand-secondary mt-2 text-xl font-bold">
              {latestDay?.date === trends.currentDate ? "Today" : "Latest day"}:{" "}
              {formatDisplayVolume(latestDay?.intakeMl ?? 0, unit)} {unit}
            </h2>
            <p className="text-brand-secondary/55 mt-2 text-sm leading-6">
              {!change
                ? "A previous eligible local day is not available for comparison."
                : change.absoluteMl === 0
                  ? "The same amount as the previous day."
                  : `${formatDisplayVolume(
                      Math.abs(change.absoluteMl),
                      unit,
                    )} ${unit} ${
                      change.absoluteMl > 0 ? "more" : "less"
                    } than the previous day${
                      change.percentage === null
                        ? "."
                        : ` (${Math.abs(change.percentage)}%).`
                    }`}
            </p>
            <DailyIntakeChart
              currentDate={trends.currentDate}
              days={trends.days}
              unit={unit}
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="border-brand-secondary/5 rounded-[2rem] border bg-white/90 p-5 sm:p-7">
              <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
                Goal completion
              </p>
              <h2 className="text-brand-secondary mt-2 text-xl font-bold">
                {trends.goalRate.percentage === null
                  ? "No eligible goal days"
                  : `${trends.goalRate.percentage}%`}
              </h2>
              <p className="text-brand-secondary/55 mt-2 text-sm leading-6">
                Goal met on {trends.goalRate.metDays} of{" "}
                {trends.goalRate.eligibleDays} eligible local days. Each day
                uses the goal effective on that date.
              </p>
              <div className="bg-brand-primary/8 mt-5 h-3 overflow-hidden rounded-full">
                <div
                  className="bg-brand-primary h-full rounded-full"
                  style={{
                    width: `${trends.goalRate.percentage ?? 0}%`,
                  }}
                />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="bg-brand-background rounded-2xl p-3">
                  <dt className="text-brand-secondary/40 text-xs font-bold uppercase">
                    Current streak
                  </dt>
                  <dd className="text-brand-secondary mt-1 font-bold">
                    {trends.currentGoalStreak} days
                  </dd>
                </div>
                <div className="bg-brand-background rounded-2xl p-3">
                  <dt className="text-brand-secondary/40 text-xs font-bold uppercase">
                    Best streak
                  </dt>
                  <dd className="text-brand-secondary mt-1 font-bold">
                    {trends.bestGoalStreak} days
                  </dd>
                </div>
              </dl>
              <p className="text-brand-secondary/40 mt-4 text-xs leading-5">
                An unfinished goal today does not end a streak that was active
                through yesterday. A missed completed local day does.
              </p>
            </section>

            <section className="border-brand-secondary/5 rounded-[2rem] border bg-white/90 p-5 sm:p-7">
              <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
                Bottle completion times
              </p>
              <h2 className="text-brand-secondary mt-2 text-xl font-bold">
                {trends.completionTiming.typicalTimeMinutes === null
                  ? "More history will reveal a pattern"
                  : `Around ${formatClockMinutes(
                      trends.completionTiming.typicalTimeMinutes,
                    )}`}
              </h2>
              <p className="text-brand-secondary/55 mt-2 text-sm leading-6">
                Based on {trends.completionTiming.sampleCount} full bottle
                completion
                {trends.completionTiming.sampleCount === 1 ? "" : "s"}. Half
                intakes, manual intake, adjustments, and reversals are excluded.
              </p>
              {trends.completionTiming.sampleCount === 0 ? (
                <p className="bg-brand-background text-brand-secondary/55 mt-5 rounded-2xl p-4 text-sm">
                  More completion-time insights will appear after a few full
                  bottles.
                </p>
              ) : (
                <CompletionTimeBlocks blocks={trends.completionTiming.blocks} />
              )}
              <p className="text-brand-secondary/40 mt-4 text-xs leading-5">
                Typical time follows the clock around midnight, avoiding a
                misleading midday average for late-night completions.
              </p>
            </section>
          </div>

          <section className="border-brand-secondary/5 min-w-0 rounded-[2rem] border bg-white/90 p-5 sm:p-7">
            <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
              Rolling average
            </p>
            <h2 className="text-brand-secondary mt-2 text-xl font-bold">
              {latestRolling
                ? `${formatDisplayVolume(
                    latestRolling.averageIntakeMl,
                    unit,
                  )} ${unit}/day`
                : "Not available yet"}
            </h2>
            {latestRolling ? (
              <>
                <p className="text-brand-secondary/55 mt-2 text-sm leading-6">
                  Based on {latestRolling.daysUsed} available day
                  {latestRolling.daysUsed === 1 ? "" : "s"}
                  {latestRolling.daysUsed < 7 ? " so far" : ""}.{" "}
                  {latestRolling.goalMl === null
                    ? "No applicable goal is available for comparison."
                    : `The goal effective today is ${formatDisplayVolume(
                        latestRolling.goalMl,
                        unit,
                      )} ${unit}/day.`}
                </p>
                <p className="text-brand-secondary mt-3 text-sm font-semibold">
                  {latestRolling.status === "above"
                    ? "Your recent average is above your goal."
                    : latestRolling.status === "near"
                      ? "Your recent average is near your goal."
                      : latestRolling.status === "below"
                        ? "Your recent average is below your goal—keep building consistency."
                        : "Keep recording to build a goal comparison."}
                </p>
                <RollingAverageChart
                  currentDate={trends.currentDate}
                  points={trends.rollingAverage}
                  unit={unit}
                />
              </>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import { connection } from "next/server";

import { EventTimeline } from "@/components/hydration/event-timeline";
import { PageHeader } from "@/components/page-header";
import { TodayRefreshController } from "@/components/today-refresh-controller";
import { getTodayDashboard } from "@/lib/application/hydration/get-today-dashboard";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { formatDisplayVolume } from "@/lib/units/volume";

import { DevelopmentControls } from "./development-controls";
import { RecordWater } from "./record-water";

function formatVolume(volumeMl: number | null, unit: "ml" | "oz"): string {
  return volumeMl === null
    ? "Not set"
    : `${formatDisplayVolume(volumeMl, unit)} ${unit}`;
}

function formatCheckpoint(
  checkpointAt: string | null,
  timezone: string,
): string {
  if (!checkpointAt) {
    return "No checkpoint yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(checkpointAt));
}

function formatCompletionTime(occurredAt: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(occurredAt));
}

function readSearchValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{
    record?: string | string[];
    source?: string | string[];
  }>;
}) {
  await connection();

  const parameters = await searchParams;
  const openRecordWater =
    readSearchValue(parameters.record) === "1" &&
    readSearchValue(parameters.source) === "push";

  const user = await requireAllowedUser("/today");
  const dashboard = await getTodayDashboard(
    await createClient(),
    user.id,
    new Date(),
  );
  const { daySummary, preferredUnit: unit } = dashboard;
  const progress = Math.min(100, daySummary.goalPercentage ?? 0);

  return (
    <>
      <TodayRefreshController />
      <PageHeader
        eyebrow={dashboard.date}
        title={
          dashboard.profile.displayName
            ? `Good to see you, ${dashboard.profile.displayName}.`
            : "Your hydration day"
        }
        description="Finish your normal bottle amount, then press once. Each press is projected from your immutable hydration history."
      />

      {!daySummary.goalMl || !dashboard.primaryBottle ? (
        <section
          role="alert"
          className="mt-7 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5"
        >
          <h2 className="text-lg font-bold text-amber-900">
            Hydration setup needs attention
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/65">
            Add an active goal and primary bottle before recording hydration.
          </p>
          <Link
            href="/settings"
            className="bg-brand-primary mt-4 inline-flex h-10 items-center rounded-xl px-4 text-sm font-bold text-white"
          >
            Review settings
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-[2rem] bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-brand-secondary/45 text-xs font-bold tracking-[0.12em] uppercase">
                  Today’s intake
                </p>
                <p className="text-brand-secondary mt-2 text-3xl font-bold tracking-tight">
                  {formatVolume(daySummary.consumedMl, unit)}
                  <span className="text-brand-secondary/30 text-lg font-semibold">
                    {" "}
                    / {formatVolume(daySummary.goalMl, unit)}
                  </span>
                </p>
              </div>
              <span className="text-brand-primary text-lg font-bold">
                {Math.round(daySummary.goalPercentage ?? 0)}%
              </span>
            </div>
            <div className="bg-brand-primary/10 mt-5 h-3 overflow-hidden rounded-full">
              <div
                className="bg-brand-primary h-full rounded-full transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-brand-secondary/55 mt-4 text-sm leading-6">
              {dashboard.coaching.message}
            </p>
            <RecordWater
              bottleName={dashboard.primaryBottle.name}
              initiallyOpen={openRecordWater}
              normalFillMl={dashboard.primaryBottle.normalFillMl}
              unit={unit}
            />
          </section>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Remaining",
                value: formatVolume(dashboard.coaching.remainingMl, unit),
              },
              {
                label: "Bottles completed",
                value: String(daySummary.completedBottleCount),
              },
              {
                label: "Pace",
                value: dashboard.coaching.status.replace("-", " "),
              },
              {
                label: "Current streak",
                value: `${dashboard.currentStreak} day${
                  dashboard.currentStreak === 1 ? "" : "s"
                }`,
              },
            ].map((card) => (
              <section
                key={card.label}
                className="border-brand-secondary/5 rounded-2xl border bg-white/75 p-4"
              >
                <p className="text-brand-secondary/40 text-[0.68rem] font-bold uppercase">
                  {card.label}
                </p>
                <p className="text-brand-secondary mt-2 text-sm font-bold capitalize">
                  {card.value}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="border-brand-secondary/5 rounded-[1.75rem] border bg-white/80 p-5">
              <h2 className="text-brand-secondary text-lg font-bold">
                Last bottle completed
              </h2>
              {dashboard.lastBottleCompleted ? (
                <div className="mt-3">
                  <p className="text-brand-secondary text-sm font-semibold">
                    {dashboard.lastBottleCompleted.bottleName}
                  </p>
                  <p className="text-brand-secondary/55 mt-1 text-sm">
                    {formatVolume(dashboard.lastBottleCompleted.amountMl, unit)}{" "}
                    ·{" "}
                    {formatCompletionTime(
                      dashboard.lastBottleCompleted.occurredAt,
                      dashboard.profile.timezone,
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-brand-secondary/50 mt-3 text-sm leading-6">
                  No bottle has been completed yet today. Finish your normal
                  bottle amount, then press once.
                </p>
              )}
              <dl className="border-brand-secondary/5 mt-5 border-t pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-brand-secondary/45">
                    Normal fill amount
                  </dt>
                  <dd className="text-brand-secondary font-bold">
                    {formatVolume(dashboard.primaryBottle.normalFillMl, unit)}
                  </dd>
                </div>
                <div className="mt-3 flex justify-between gap-3">
                  <dt className="text-brand-secondary/45">Next checkpoint</dt>
                  <dd className="text-brand-secondary font-bold">
                    {formatCheckpoint(
                      dashboard.coaching.nextCheckpoint?.targetAt ?? null,
                      dashboard.profile.timezone,
                    )}
                  </dd>
                </div>
                <div className="mt-3 flex justify-between gap-3">
                  <dt className="text-brand-secondary/45">Catch-up pace</dt>
                  <dd className="text-brand-secondary font-bold">
                    {dashboard.coaching.requiredMlPerHour === null
                      ? "Target passed"
                      : dashboard.coaching.requiredMlPerHour === 0
                        ? "Complete"
                        : `${formatDisplayVolume(
                            dashboard.coaching.requiredMlPerHour,
                            unit,
                          )} ${unit}/hr`}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="border-brand-secondary/5 rounded-[1.75rem] border bg-white/80 p-5">
              <h2 className="text-brand-secondary text-lg font-bold">
                Recordings
              </h2>
              <EventTimeline
                events={daySummary.timeline}
                timezone={dashboard.profile.timezone}
                unit={unit}
              />
            </section>
          </div>

          {process.env.NODE_ENV === "development" ? (
            <DevelopmentControls
              bottleId={dashboard.primaryBottle.id}
              latestReversibleEvent={dashboard.latestEffectiveEvent}
              unit={unit}
            />
          ) : null}
        </>
      )}
    </>
  );
}

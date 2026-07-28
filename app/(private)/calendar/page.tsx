import Link from "next/link";
import { connection } from "next/server";

import { EventTimeline } from "@/components/hydration/event-timeline";
import { PageHeader } from "@/components/page-header";
import { buildCalendarSummary } from "@/lib/application/hydration/hydration-projection";
import { getDateInTimezone } from "@/lib/domain/hydration/hydration-day";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { formatDisplayVolume } from "@/lib/units/volume";

function readParameter(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function isMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(value));
}

function moveMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (monthNumber ?? 1) - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function displayEventTime(value: string | null, timezone: string): string {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(value))
    : "—";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    day?: string | string[];
    month?: string | string[];
  }>;
}) {
  await connection();

  const user = await requireAllowedUser("/calendar");
  const snapshot = await getHydrationSnapshot(await createClient(), user.id);
  const parameters = await searchParams;
  const requestedMonth = readParameter(parameters.month);
  const currentMonth = getDateInTimezone(
    snapshot.profile?.timezone ?? "America/New_York",
  ).slice(0, 7);
  const month = isMonth(requestedMonth) ? requestedMonth : currentMonth;
  const calendar = buildCalendarSummary(snapshot, month);
  const requestedDay = readParameter(parameters.day);
  const selectedDay =
    calendar.days.find((day) => day.date === requestedDay) ??
    calendar.days.find((day) => day.date === `${month}-01`) ??
    null;
  const firstWeekday = new Date(`${month}-01T00:00:00.000Z`).getUTCDay();

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Hydration history"
        description="Each day is reconstructed from immutable effective events in your local timezone."
      />

      <section className="mt-8 rounded-[2rem] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="flex items-center justify-between">
          <Link
            href={`/calendar?month=${moveMonth(month, -1)}`}
            aria-label="Previous month"
            className="border-brand-secondary/10 rounded-xl border px-3 py-2 text-sm font-bold"
          >
            ←
          </Link>
          <h2 className="text-brand-secondary text-lg font-bold">
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              timeZone: "UTC",
              year: "numeric",
            }).format(new Date(`${month}-01T00:00:00.000Z`))}
          </h2>
          <Link
            href={`/calendar?month=${moveMonth(month, 1)}`}
            aria-label="Next month"
            className="border-brand-secondary/10 rounded-xl border px-3 py-2 text-sm font-bold"
          >
            →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-1 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span
              key={day}
              className="text-brand-secondary/35 py-2 text-[0.65rem] font-bold uppercase"
            >
              {day.slice(0, 1)}
            </span>
          ))}
          {Array.from({ length: firstWeekday }, (_, index) => (
            <span key={`empty-${index}`} />
          ))}
          {calendar.days.map((day) => {
            const selected = day.date === selectedDay?.date;
            const percentage = Math.min(100, day.goalPercentage ?? 0);

            return (
              <Link
                key={day.date}
                href={`/calendar?month=${month}&day=${day.date}`}
                aria-label={`View ${day.date}`}
                className={`relative flex min-h-16 flex-col items-center rounded-xl p-1.5 text-xs transition ${
                  selected
                    ? "bg-brand-primary text-white"
                    : "hover:bg-brand-primary/5 text-brand-secondary"
                }`}
              >
                <span className="font-bold">{Number(day.date.slice(-2))}</span>
                <span
                  className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${
                    selected ? "bg-white/25" : "bg-brand-primary/10"
                  }`}
                >
                  <span
                    className={`block h-full rounded-full ${
                      selected ? "bg-white" : "bg-brand-primary"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </span>
                <span className="mt-1 text-[0.58rem] font-bold">
                  {day.completedBottleCount || "—"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {selectedDay ? (
        <section className="border-brand-secondary/5 mt-5 rounded-[1.75rem] border bg-white/80 p-5 sm:p-6">
          <h2 className="text-brand-secondary text-lg font-bold">
            {displayDate(selectedDay.date)}
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Intake",
                value: `${formatDisplayVolume(
                  selectedDay.consumedMl,
                  calendar.preferredUnit,
                )} ${calendar.preferredUnit}`,
              },
              {
                label: "Goal",
                value: selectedDay.goalMl
                  ? `${formatDisplayVolume(
                      selectedDay.goalMl,
                      calendar.preferredUnit,
                    )} ${calendar.preferredUnit}`
                  : "Not set",
              },
              {
                label: "Bottles",
                value: String(selectedDay.completedBottleCount),
              },
              {
                label: "Goal reached",
                value: selectedDay.goalReached
                  ? displayEventTime(
                      selectedDay.goalReachedAt,
                      calendar.timezone,
                    )
                  : "No",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-brand-background rounded-2xl p-3"
              >
                <p className="text-brand-secondary/40 text-[0.65rem] font-bold uppercase">
                  {item.label}
                </p>
                <p className="text-brand-secondary mt-1 text-sm font-bold">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          <dl className="border-brand-secondary/5 mt-5 grid gap-2 border-t pt-5 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt className="text-brand-secondary/45">First event</dt>
              <dd className="font-bold">
                {displayEventTime(
                  selectedDay.firstEffectiveEvent?.occurredAt ?? null,
                  calendar.timezone,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-brand-secondary/45">Last event</dt>
              <dd className="font-bold">
                {displayEventTime(
                  selectedDay.lastEffectiveEvent?.occurredAt ?? null,
                  calendar.timezone,
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-5">
            <h3 className="text-brand-secondary text-sm font-bold">
              Event timeline
            </h3>
            <EventTimeline
              events={selectedDay.timeline}
              timezone={calendar.timezone}
              unit={calendar.preferredUnit}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}

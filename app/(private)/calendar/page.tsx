import { connection } from "next/server";

import { EventTimeline } from "@/components/hydration/event-timeline";
import { PageHeader } from "@/components/page-header";
import { buildCalendarSummary } from "@/lib/application/hydration/hydration-projection";
import { getDateInTimezone } from "@/lib/domain/hydration/hydration-day";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { formatDisplayVolume } from "@/lib/units/volume";

import { CalendarGrid } from "./calendar-grid";

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
  const currentDate = getDateInTimezone(
    snapshot.profile?.timezone ?? "America/New_York",
  );
  const currentMonth = currentDate.slice(0, 7);
  const month = isMonth(requestedMonth) ? requestedMonth : currentMonth;
  const calendar = buildCalendarSummary(snapshot, month);
  const requestedDay = readParameter(parameters.day);
  const selectedDay =
    calendar.days.find((day) => day.date === requestedDay) ??
    (month === currentMonth
      ? calendar.days.find((day) => day.date === currentDate)
      : null) ??
    calendar.days.find((day) => day.date === `${month}-01`) ??
    null;

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Hydration history"
        description="Each day is reconstructed from immutable effective events in your local timezone."
      />

      <CalendarGrid
        currentDate={currentDate}
        currentMonth={currentMonth}
        days={calendar.days}
        month={month}
        nextMonth={moveMonth(month, 1)}
        previousMonth={moveMonth(month, -1)}
        selectedDate={selectedDay?.date ?? null}
      />

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

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  buildCalendarWeeks,
  getCurrentWeekIndex,
} from "@/lib/application/calendar/calendar-view";
import type { HydrationDaySummary } from "@/lib/domain/hydration/daily-summary";

export function CalendarGrid({
  currentDate,
  currentMonth,
  days,
  month,
  nextMonth,
  previousMonth,
  selectedDate,
}: {
  currentDate: string;
  currentMonth: string;
  days: HydrationDaySummary[];
  month: string;
  nextMonth: string;
  previousMonth: string;
  selectedDate: string | null;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const weekRefs = useRef<Array<HTMLDivElement | null>>([]);
  const weeks = useMemo(() => buildCalendarWeeks(month, days), [days, month]);
  const currentWeekIndex = getCurrentWeekIndex(month, currentDate);
  const scrollCurrentWeekToTop = useCallback(() => {
    if (currentWeekIndex === null) {
      viewportRef.current?.scrollTo({ top: 0 });
      return;
    }

    const viewport = viewportRef.current;
    const currentWeek = weekRefs.current[currentWeekIndex];

    if (!viewport || !currentWeek) {
      return;
    }

    const viewportTop = viewport.getBoundingClientRect().top;
    const weekTop = currentWeek.getBoundingClientRect().top;
    viewport.scrollTo({
      behavior: "auto",
      top: viewport.scrollTop + weekTop - viewportTop,
    });
  }, [currentWeekIndex]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(scrollCurrentWeekToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [month, scrollCurrentWeekToTop]);

  return (
    <section className="mt-8 rounded-[2rem] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Link
          href={`/calendar?month=${previousMonth}`}
          aria-label="Previous month"
          className="border-brand-secondary/10 flex size-11 items-center justify-center rounded-xl border text-sm font-bold"
        >
          ←
        </Link>
        <div className="min-w-0 text-center">
          <h2 className="text-brand-secondary truncate text-lg font-bold">
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              timeZone: "UTC",
              year: "numeric",
            }).format(new Date(`${month}-01T00:00:00.000Z`))}
          </h2>
          <Link
            href={`/calendar?month=${currentMonth}&day=${currentDate}`}
            onClick={scrollCurrentWeekToTop}
            className="text-brand-primary mt-1 inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold"
          >
            Today
          </Link>
        </div>
        <Link
          href={`/calendar?month=${nextMonth}`}
          aria-label="Next month"
          className="border-brand-secondary/10 flex size-11 items-center justify-center rounded-xl border text-sm font-bold"
        >
          →
        </Link>
      </div>

      <div
        className="mt-5 grid grid-cols-7 gap-1 text-center"
        aria-hidden="true"
      >
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span
            key={`${day}-${index}`}
            className="text-brand-secondary/35 py-2 text-[0.65rem] font-bold uppercase"
          >
            {day}
          </span>
        ))}
      </div>

      <div
        ref={viewportRef}
        aria-label="Hydration calendar dates"
        className="relative max-h-[26rem] overflow-y-auto overscroll-contain"
      >
        <div className="grid gap-1">
          {weeks.map((week, weekIndex) => (
            <div
              key={`week-${weekIndex}`}
              ref={(element) => {
                weekRefs.current[weekIndex] = element;
              }}
              data-current-week={
                currentWeekIndex === weekIndex ? "true" : undefined
              }
              className="grid grid-cols-7 gap-1"
            >
              {week.map((day, dayIndex) => {
                if (!day) {
                  return (
                    <span
                      key={`empty-${weekIndex}-${dayIndex}`}
                      aria-hidden="true"
                      className="min-h-20"
                    />
                  );
                }

                const isToday = day.date === currentDate;
                const isSelected = day.date === selectedDate;
                const percentage = Math.min(100, day.goalPercentage ?? 0);
                const stateLabel =
                  isToday && isSelected
                    ? ", today and selected"
                    : isToday
                      ? ", today"
                      : isSelected
                        ? ", selected"
                        : "";

                return (
                  <Link
                    key={day.date}
                    href={`/calendar?month=${month}&day=${day.date}`}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`View ${day.date}${stateLabel}`}
                    data-selected={isSelected ? "true" : undefined}
                    data-today={isToday ? "true" : undefined}
                    className={`relative flex min-h-20 min-w-0 flex-col items-center rounded-xl border p-1.5 text-xs transition ${
                      isToday && isSelected
                        ? "border-brand-secondary bg-brand-primary ring-brand-secondary text-white ring-2"
                        : isSelected
                          ? "border-brand-secondary bg-brand-secondary text-white"
                          : isToday
                            ? "border-brand-primary bg-brand-primary/8 text-brand-primary ring-brand-primary/20 ring-2"
                            : "text-brand-secondary hover:bg-brand-primary/5 border-transparent"
                    }`}
                  >
                    <span className="font-bold">
                      {Number(day.date.slice(-2))}
                    </span>
                    <span className="mt-0.5 min-h-3 text-[0.5rem] font-bold uppercase">
                      {isToday && isSelected
                        ? "Today ✓"
                        : isToday
                          ? "Today"
                          : isSelected
                            ? "✓"
                            : ""}
                    </span>
                    <span
                      className={`mt-1 h-1.5 w-full overflow-hidden rounded-full ${
                        isSelected ? "bg-white/25" : "bg-brand-primary/10"
                      }`}
                    >
                      <span
                        className={`block h-full rounded-full ${
                          isSelected ? "bg-white" : "bg-brand-primary"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </span>
                    <span className="mt-1 text-[0.58rem] font-bold">
                      {day.completedBottleCount || "—"}
                    </span>
                    {isSelected && !isToday ? (
                      <span className="sr-only">Selected date</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        {currentWeekIndex !== null ? (
          <div aria-hidden="true" className="h-[22rem]" />
        ) : null}
      </div>
    </section>
  );
}

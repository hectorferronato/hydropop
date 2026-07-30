"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  buildCalendarWeeks,
  getCurrentWeekIndex,
  getWeekIndexForDate,
  visibleCalendarWeekRows,
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
  const selectedWeekIndex = getWeekIndexForDate(month, selectedDate);
  const scrollWeekIntoView = useCallback(
    (weekIndex: number, alignment: "nearest" | "start") => {
      const viewport = viewportRef.current;
      const week = weekRefs.current[weekIndex];

      if (!viewport || !week) {
        return;
      }

      const viewportBounds = viewport.getBoundingClientRect();
      const weekBounds = week.getBoundingClientRect();
      const top = viewport.scrollTop + weekBounds.top - viewportBounds.top;

      if (alignment === "start" || weekBounds.top < viewportBounds.top) {
        viewport.scrollTo({ behavior: "auto", top });
        return;
      }

      if (weekBounds.bottom > viewportBounds.bottom) {
        viewport.scrollTo({
          behavior: "auto",
          top: viewport.scrollTop + weekBounds.bottom - viewportBounds.bottom,
        });
      }
    },
    [],
  );
  const scrollCurrentWeekToTop = useCallback(() => {
    if (currentWeekIndex === null) {
      viewportRef.current?.scrollTo({ top: 0 });
      return;
    }

    scrollWeekIntoView(currentWeekIndex, "start");
  }, [currentWeekIndex, scrollWeekIntoView]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (selectedWeekIndex !== null && selectedDate !== currentDate) {
        scrollWeekIntoView(selectedWeekIndex, "nearest");
        return;
      }

      if (currentWeekIndex !== null) {
        scrollCurrentWeekToTop();
        return;
      }

      if (selectedWeekIndex !== null) {
        scrollWeekIntoView(selectedWeekIndex, "nearest");
        return;
      }

      viewportRef.current?.scrollTo({ top: 0 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    currentDate,
    currentWeekIndex,
    month,
    scrollCurrentWeekToTop,
    scrollWeekIntoView,
    selectedDate,
    selectedWeekIndex,
  ]);

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
        data-testid="calendar-weekday-header"
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

      <p
        id="calendar-scroll-hint"
        className="text-brand-secondary/35 mt-1 text-right text-[0.62rem] font-semibold"
      >
        Scroll for all {weeks.length} weeks
      </p>

      <div className="relative mt-1 overflow-hidden rounded-xl">
        <div
          ref={viewportRef}
          aria-describedby="calendar-scroll-hint"
          aria-label="Hydration calendar dates"
          data-testid="calendar-week-viewport"
          data-visible-week-rows={visibleCalendarWeekRows}
          className="h-[calc((var(--calendar-week-row-height)*2)+var(--calendar-week-gap))] touch-pan-y snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-contain [--calendar-week-gap:0.25rem] [--calendar-week-row-height:5rem]"
        >
          <div className="grid gap-[var(--calendar-week-gap)]">
            {weeks.map((week, weekIndex) => (
              <div
                key={`week-${weekIndex}`}
                ref={(element) => {
                  weekRefs.current[weekIndex] = element;
                }}
                data-current-week={
                  currentWeekIndex === weekIndex ? "true" : undefined
                }
                data-calendar-week={weekIndex}
                className="grid h-[var(--calendar-week-row-height)] snap-start scroll-mt-0 grid-cols-7 gap-1"
              >
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return (
                      <span
                        key={`empty-${weekIndex}-${dayIndex}`}
                        aria-hidden="true"
                        className="h-full"
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
                      onFocus={() => scrollWeekIntoView(weekIndex, "nearest")}
                      className={`relative flex h-full min-w-0 flex-col items-center rounded-xl border p-1.5 text-xs transition ${
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
            {currentWeekIndex !== null ? (
              <div
                aria-hidden="true"
                className="h-[calc(var(--calendar-week-row-height)+var(--calendar-week-gap))]"
              />
            ) : null}
          </div>
        </div>
        <div
          aria-hidden="true"
          className="from-brand-secondary/8 pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t to-transparent"
        />
      </div>
    </section>
  );
}

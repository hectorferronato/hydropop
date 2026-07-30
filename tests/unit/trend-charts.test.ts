import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DailyIntakeChart,
  RollingAverageChart,
} from "@/app/(private)/trends/trend-charts";
import type { RollingAveragePoint, TrendDay } from "@/lib/contracts/trends";

const currentDate = "2026-07-30";

function dateForDay(day: number): string {
  return `2026-07-${String(day).padStart(2, "0")}`;
}

function sevenTrendDays(): TrendDay[] {
  return Array.from({ length: 7 }, (_, index) => ({
    change: null,
    date: dateForDay(24 + index),
    goalMet: false,
    goalMl: index < 3 ? 2_000 : 2_500,
    intakeMl: index === 0 ? 0 : 1_000 + index * 100,
  }));
}

function sevenRollingPoints(): RollingAveragePoint[] {
  return Array.from({ length: 7 }, (_, index) => ({
    averageIntakeMl: 1_000 + index * 100,
    date: dateForDay(24 + index),
    daysUsed: index + 1,
    goalMl: index < 3 ? 2_000 : 2_500,
    status: "below",
  }));
}

describe("trend chart markup", () => {
  it("renders every seven-day intake bar, date, value, and changed goal", () => {
    const html = renderToStaticMarkup(
      createElement(DailyIntakeChart, {
        currentDate,
        days: sevenTrendDays(),
        unit: "oz",
      }),
    );

    expect(html.match(/data-chart-day=/gu)).toHaveLength(14);
    expect(html).toContain("Today");
    expect(html).toContain("0 oz");
    expect(html).toContain("Goal 67.6 oz");
    expect(html).toContain("Goal 84.5 oz");
    expect(html).toContain("Daily hydration intake and applicable goals");
    expect(html).toContain("Friday, July 24, 2026");
  });

  it("renders every rolling point with partial-window context and latest emphasis", () => {
    const html = renderToStaticMarkup(
      createElement(RollingAverageChart, {
        currentDate,
        points: sevenRollingPoints(),
        unit: "ml",
      }),
    );

    expect(html.match(/data-rolling-point=/gu)).toHaveLength(14);
    expect(html.match(/data-latest-point="true"/gu)).toHaveLength(2);
    expect(html).toContain("Today");
    expect(html).toContain("1600 ml");
    expect(html).toContain("Goal 2000 ml/day");
    expect(html).toContain("Goal 2500 ml/day");
    expect(html).toContain("based on 1 day");
    expect(html).toContain(
      "Rolling average hydration and date-effective goals",
    );
  });

  it("keeps every long-range data point while using responsive visual variants", () => {
    const days = Array.from({ length: 30 }, (_, index) => ({
      ...sevenTrendDays()[index % 7]!,
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    }));
    const html = renderToStaticMarkup(
      createElement(DailyIntakeChart, {
        currentDate,
        days,
        unit: "oz",
      }),
    );

    expect(html.match(/data-chart-day=/gu)).toHaveLength(60);
    expect(html).toContain("max-w-[20rem]");
    expect(html).toContain("max-w-[40rem]");
    expect(html).toContain("<tbody>");
  });
});

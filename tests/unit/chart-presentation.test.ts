import { describe, expect, it } from "vitest";

import {
  formatAccessibleChartDate,
  formatChartDateLabel,
  formatChartGoalLabel,
  formatChartValueLabel,
  getGoalChangeIndices,
  getPriorityValueIndices,
  shouldShowChartDateLabel,
} from "@/lib/application/analytics/chart-presentation";

describe("trend chart presentation", () => {
  it("formats profile-local date strings without UTC date shifting", () => {
    expect(formatChartDateLabel("2026-07-24", "2026-07-30", 7)).toBe("Fri");
    expect(formatChartDateLabel("2026-07-30", "2026-07-30", 7)).toBe("Today");
    expect(formatChartDateLabel("2026-07-24", "2026-07-30", 30)).toBe("Jul 24");
    expect(formatAccessibleChartDate("2026-07-30", "2026-07-30")).toContain(
      "(today)",
    );
  });

  it("uses the existing volume formatter for concise chart labels", () => {
    expect(formatChartValueLabel(1_360, "oz")).toBe("46 oz");
    expect(formatChartValueLabel(0, "oz")).toBe("0 oz");
    expect(formatChartValueLabel(1_500, "ml", true)).toBe("1500 ml/day");
    expect(formatChartGoalLabel(4_495, "oz")).toBe("Goal 152 oz");
    expect(formatChartGoalLabel(1_500, "ml", true)).toBe("Goal 1500 ml/day");
  });

  it("shows every date for seven-day charts", () => {
    expect(
      Array.from({ length: 7 }, (_, index) =>
        shouldShowChartDateLabel({
          density: "compact",
          index,
          isToday: index === 6,
          totalPoints: 7,
        }),
      ),
    ).toEqual([true, true, true, true, true, true, true]);
  });

  it("reduces long-range label density without hiding edges or today", () => {
    const compactVisible = Array.from({ length: 30 }, (_, index) =>
      shouldShowChartDateLabel({
        density: "compact",
        index,
        isToday: index === 29,
        totalPoints: 30,
      }),
    ).filter(Boolean);
    const comfortableVisible = Array.from({ length: 30 }, (_, index) =>
      shouldShowChartDateLabel({
        density: "comfortable",
        index,
        isToday: index === 29,
        totalPoints: 30,
      }),
    ).filter(Boolean);

    expect(compactVisible).toHaveLength(6);
    expect(comfortableVisible).toHaveLength(7);
    expect(
      shouldShowChartDateLabel({
        density: "compact",
        index: 29,
        isToday: true,
        totalPoints: 30,
      }),
    ).toBe(true);
  });

  it("labels only actual goal changes instead of implying one goal", () => {
    expect(
      getGoalChangeIndices([null, 2_000, 2_000, 2_500, 2_500, null, 3_000]),
    ).toEqual([1, 3, 6]);
  });

  it("prioritizes latest, highest, lowest, and interval values on long charts", () => {
    const values = Array.from({ length: 30 }, (_, index) => 1_000 + index);
    values[4] = 100;
    values[18] = 5_000;
    const compact = getPriorityValueIndices(values, "compact");

    expect(compact).toEqual(expect.arrayContaining([0, 4, 18, 29]));
    expect(compact.length).toBeLessThan(values.length);
    expect(getPriorityValueIndices([], "compact")).toEqual([]);
  });
});

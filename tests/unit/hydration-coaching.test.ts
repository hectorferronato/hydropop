import { describe, expect, it } from "vitest";

import { calculateCatchUpRate } from "@/lib/domain/coaching/catch-up";
import { calculateHydrationCoaching } from "@/lib/domain/coaching/coaching";
import { calculateExpectedIntake } from "@/lib/domain/coaching/expected-intake";
import { localDateTimeToInstant } from "@/lib/domain/hydration/hydration-day";

const baseInput = {
  normalFillMl: 710,
  consumedMl: 700,
  date: "2026-07-28",
  goalMl: 2_130,
  now: new Date("2026-07-28T16:00:00.000Z"),
  targetCompletionTime: "20:00",
  timezone: "America/New_York",
  wakeTime: "08:00",
};

describe("deterministic hydration coaching", () => {
  it("expects zero intake before wake time", () => {
    const result = calculateExpectedIntake({
      ...baseInput,
      now: new Date("2026-07-28T11:00:00.000Z"),
    });

    expect(result).toMatchObject({ expectedMl: 0, phase: "before-wake" });
  });

  it("expects the full goal after completion time", () => {
    const result = calculateExpectedIntake({
      ...baseInput,
      now: new Date("2026-07-29T01:00:00.000Z"),
    });

    expect(result).toMatchObject({
      expectedMl: 2_130,
      phase: "after-target",
    });
  });

  it("marks a reached goal without a catch-up recommendation", () => {
    const coaching = calculateHydrationCoaching({
      ...baseInput,
      consumedMl: 2_200,
    });

    expect(coaching.status).toBe("goal-reached");
    expect(coaching.remainingMl).toBe(0);
    expect(coaching.requiredMlPerHour).toBe(0);
    expect(coaching.nextCheckpoint).toBeNull();
  });

  it("calculates a deterministic catch-up rate", () => {
    expect(
      calculateCatchUpRate({
        consumedMl: 1_000,
        goalMl: 2_000,
        now: new Date("2026-07-28T18:00:00.000Z"),
        targetAt: "2026-07-28T20:00:00.000Z",
      }),
    ).toBe(500);
  });

  it("returns no finite catch-up rate after the target", () => {
    expect(
      calculateCatchUpRate({
        consumedMl: 1_000,
        goalMl: 2_000,
        now: new Date("2026-07-28T21:00:00.000Z"),
        targetAt: "2026-07-28T20:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("supports a goal smaller than a bottle", () => {
    const coaching = calculateHydrationCoaching({
      ...baseInput,
      consumedMl: 0,
      goalMl: 500,
    });

    expect(coaching.nextCheckpoint?.targetVolumeMl).toBe(500);
    expect(coaching.bottleEquivalentsRemaining).toBe(0.7);
  });

  it("supports goals not divisible by bottle capacity", () => {
    const coaching = calculateHydrationCoaching({
      ...baseInput,
      consumedMl: 1_420,
      goalMl: 2_000,
    });

    expect(coaching.nextCheckpoint?.targetVolumeMl).toBe(2_000);
  });

  it("uses the configured typical fill for equivalents and checkpoints", () => {
    const coaching = calculateHydrationCoaching({
      ...baseInput,
      normalFillMl: 650,
    });

    expect(coaching.bottleEquivalentsRemaining).toBe(2.2);
    expect(coaching.nextCheckpoint?.targetVolumeMl).toBe(1_300);
  });

  it("uses physical capacity when it is the effective normal-fill fallback", () => {
    const coaching = calculateHydrationCoaching({
      ...baseInput,
      normalFillMl: 710,
    });

    expect(coaching.bottleEquivalentsRemaining).toBe(2);
    expect(coaching.nextCheckpoint?.targetVolumeMl).toBe(710);
  });

  it("supports overnight hydration schedules", () => {
    const expected = calculateExpectedIntake({
      ...baseInput,
      date: "2026-07-28",
      now: new Date("2026-07-29T03:00:00.000Z"),
      targetCompletionTime: "02:00",
      wakeTime: "22:00",
    });

    expect(expected?.phase).toBe("in-progress");
    expect(expected?.targetAt).toBe("2026-07-29T06:00:00.000Z");
  });

  it("uses real elapsed time across daylight-saving transitions", () => {
    const beforeJump = localDateTimeToInstant(
      { date: "2026-03-08", time: "01:00" },
      "America/New_York",
    );
    const afterJump = localDateTimeToInstant(
      { date: "2026-03-08", time: "03:00" },
      "America/New_York",
    );

    expect(afterJump.getTime() - beforeJump.getTime()).toBe(60 * 60 * 1_000);
  });

  it("returns an explicit not-configured state for a missing goal", () => {
    const coaching = calculateHydrationCoaching({
      ...baseInput,
      goalMl: null,
    });

    expect(coaching.status).toBe("not-configured");
    expect(coaching.message).toContain("Complete your hydration plan");
  });

  it("does not invent bottle equivalents without a primary bottle", () => {
    const coaching = calculateHydrationCoaching({
      ...baseInput,
      normalFillMl: null,
    });

    expect(coaching.bottleEquivalentsRemaining).toBeNull();
    expect(coaching.nextCheckpoint).toBeNull();
  });

  it("floors negative intake before calculating numerical guidance", () => {
    const coaching = calculateHydrationCoaching({
      ...baseInput,
      consumedMl: -500,
    });

    expect(coaching.remainingMl).toBe(2_130);
  });
});

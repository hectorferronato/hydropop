import { describe, expect, it } from "vitest";

import {
  evaluatePaceReminder,
  PACE_REMINDER_POLICY,
  type PaceReminderCandidate,
} from "@/lib/domain/coaching/pace-reminder";

const baseCandidate: PaceReminderCandidate = {
  behindEpisode: 0,
  goalMl: 2400,
  lastHydrationAt: null,
  lastPaceStatus: null,
  lastReminderAttemptedAt: null,
  lastReminderSentAt: null,
  localDate: "2026-08-04",
  normalFillMl: 700,
  preferredUnit: "ml",
  reminderCount: 0,
  targetCompletionTime: "20:00:00",
  timezone: "UTC",
  todayIntakeMl: 300,
  wakeTime: "08:00:00",
};

function at(hour: number, minute = 0) {
  return new Date(
    `2026-08-04T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
  );
}

describe("pace reminder policy", () => {
  it("documents the bounded pilot policy", () => {
    expect(PACE_REMINDER_POLICY).toEqual({
      cooldownMinutes: 45,
      endHour: 20,
      maxPerDay: 4,
      recentHydrationMinutes: 20,
      repeatMinutes: 90,
      startHour: 9,
    });
  });

  it("does not send outside the 09:00–20:00 member-local window", () => {
    expect(evaluatePaceReminder(baseCandidate, at(8, 59))).toMatchObject({
      paceStatus: "outside-window",
      shouldSend: false,
    });
    expect(evaluatePaceReminder(baseCandidate, at(20))).toMatchObject({
      paceStatus: "outside-window",
      shouldSend: false,
    });
  });

  it("uses the member timezone rather than the scheduler timezone", () => {
    const pacific = {
      ...baseCandidate,
      timezone: "America/Los_Angeles",
    };
    expect(evaluatePaceReminder(pacific, at(19))).toMatchObject({
      paceStatus: "behind",
      shouldSend: true,
    });
  });

  it("sends the initial reminder only when shared pace status is behind", () => {
    expect(evaluatePaceReminder(baseCandidate, at(12))).toMatchObject({
      paceStatus: "behind",
      shouldSend: true,
      title: "HydroPOP check-in 💧",
    });
    expect(
      evaluatePaceReminder({ ...baseCandidate, todayIntakeMl: 1300 }, at(12)),
    ).toMatchObject({ shouldSend: false });
    expect(
      evaluatePaceReminder({ ...baseCandidate, todayIntakeMl: 750 }, at(12)),
    ).toMatchObject({ paceStatus: "on-track", shouldSend: false });
  });

  it("suppresses reminders for twenty minutes after effective hydration", () => {
    expect(
      evaluatePaceReminder(
        { ...baseCandidate, lastHydrationAt: at(11, 41).toISOString() },
        at(12),
      ),
    ).toMatchObject({ paceStatus: "recent-hydration", shouldSend: false });
    expect(
      evaluatePaceReminder(
        { ...baseCandidate, lastHydrationAt: at(11, 40).toISOString() },
        at(12),
      ),
    ).toMatchObject({ paceStatus: "behind", shouldSend: true });
  });

  it("waits ninety minutes between reminders in one behind episode", () => {
    const candidate = {
      ...baseCandidate,
      lastPaceStatus: "behind",
      lastReminderSentAt: at(10, 31).toISOString(),
      reminderCount: 1,
    };
    expect(evaluatePaceReminder(candidate, at(12))).toMatchObject({
      shouldSend: false,
    });
    expect(
      evaluatePaceReminder(
        { ...candidate, lastReminderSentAt: at(10, 30).toISOString() },
        at(12),
      ),
    ).toMatchObject({ shouldSend: true });
    expect(
      evaluatePaceReminder(
        {
          ...candidate,
          lastReminderAttemptedAt: at(10).toISOString(),
          lastReminderSentAt: at(11).toISOString(),
        },
        at(12),
      ),
    ).toMatchObject({ shouldSend: false });
  });

  it("uses a global cooldown when recovery is followed by a new episode", () => {
    const recovered = {
      ...baseCandidate,
      lastPaceStatus: "on-track",
      lastReminderSentAt: at(11, 16).toISOString(),
      reminderCount: 1,
    };
    expect(evaluatePaceReminder(recovered, at(12))).toMatchObject({
      shouldSend: false,
    });
    expect(
      evaluatePaceReminder(
        { ...recovered, lastReminderSentAt: at(11, 15).toISOString() },
        at(12),
      ),
    ).toMatchObject({ shouldSend: true });
  });

  it("enforces the daily cap and suppresses reached goals", () => {
    expect(
      evaluatePaceReminder({ ...baseCandidate, reminderCount: 4 }, at(12)),
    ).toMatchObject({ shouldSend: false });
    expect(
      evaluatePaceReminder({ ...baseCandidate, todayIntakeMl: 2400 }, at(19)),
    ).toMatchObject({ paceStatus: "goal-reached", shouldSend: false });
  });

  it("requires an active goal and persisted hydration schedule", () => {
    for (const candidate of [
      { ...baseCandidate, goalMl: null },
      { ...baseCandidate, normalFillMl: null },
      { ...baseCandidate, wakeTime: null },
      { ...baseCandidate, targetCompletionTime: null },
    ]) {
      expect(evaluatePaceReminder(candidate, at(12))).toMatchObject({
        paceStatus: "not-configured",
        shouldSend: false,
      });
    }
  });

  it("renders a bounded suggestion in the member display unit", () => {
    const milliliters = evaluatePaceReminder(baseCandidate, at(12));
    const ounces = evaluatePaceReminder(
      { ...baseCandidate, preferredUnit: "oz" },
      at(12),
    );
    expect(milliliters.body).toContain("350 ml");
    expect(ounces.body).toContain("11.8 oz");
    expect(milliliters.body?.length).toBeLessThanOrEqual(180);
  });
});

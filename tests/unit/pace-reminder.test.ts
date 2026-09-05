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
      maxPerDay: 6,
      recentHydrationMinutes: 20,
      repeatMinutes: 60,
    });
  });

  it("does not send outside the profile 08:00–20:00 member-local window", () => {
    expect(evaluatePaceReminder(baseCandidate, at(7, 59))).toMatchObject({
      reason: "outside_notification_window",
      shouldSend: false,
    });
    expect(evaluatePaceReminder(baseCandidate, at(20))).toMatchObject({
      reason: "outside_notification_window",
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
      title: "Time for some water 💧",
    });
    expect(
      evaluatePaceReminder({ ...baseCandidate, todayIntakeMl: 1300 }, at(12)),
    ).toMatchObject({ shouldSend: true });
    expect(
      evaluatePaceReminder({ ...baseCandidate, todayIntakeMl: 750 }, at(12)),
    ).toMatchObject({ paceStatus: "on-track", shouldSend: true });
  });

  it("suppresses reminders for twenty minutes after effective hydration", () => {
    expect(
      evaluatePaceReminder(
        { ...baseCandidate, lastHydrationAt: at(11, 41).toISOString() },
        at(12),
      ),
    ).toMatchObject({ reason: "hydrated_recently", shouldSend: false });
    expect(
      evaluatePaceReminder(
        { ...baseCandidate, lastHydrationAt: at(11, 40).toISOString() },
        at(12),
      ),
    ).toMatchObject({ paceStatus: "behind", shouldSend: true });
  });

  it("waits sixty minutes between reminders in one behind episode", () => {
    const candidate = {
      ...baseCandidate,
      lastPaceStatus: "behind",
      lastReminderSentAt: at(11, 1).toISOString(),
      reminderCount: 1,
    };
    expect(evaluatePaceReminder(candidate, at(12))).toMatchObject({
      shouldSend: false,
    });
    expect(
      evaluatePaceReminder(
        { ...candidate, lastReminderSentAt: at(11).toISOString() },
        at(12),
      ),
    ).toMatchObject({ shouldSend: true });
    expect(
      evaluatePaceReminder(
        {
          ...candidate,
          lastReminderAttemptedAt: at(10).toISOString(),
          lastReminderSentAt: at(11, 1).toISOString(),
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
      evaluatePaceReminder({ ...baseCandidate, reminderCount: 6 }, at(12)),
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

describe("adaptive cadence", () => {
  it.each([
    [{ enabled: false }, "notifications_disabled"],
    [{ activeSubscriptionCount: 0 }, "no_active_subscription"],
    [{ goalMl: null }, "no_goal"],
    [{ normalFillMl: null }, "no_primary_bottle"],
  ] as const)("reports eligibility %j", (extra, reason) => {
    expect(
      evaluatePaceReminder({ ...baseCandidate, ...extra }, at(12)),
    ).toMatchObject({ shouldSend: false, reason });
  });
  it.each([
    ["balanced", 60, 180, 240, 6],
    ["gentle", 90, 240, 240, 4],
    ["frequent", 45, 120, 180, 8],
  ] as const)("bounds %s cadence", (frequency, behind, onTrack, ahead, cap) => {
    for (const [pace, intake, minutes] of [
      ["behind", 300, behind],
      ["on-track", 800, onTrack],
      ["ahead", 1400, ahead],
    ] as const) {
      const last = new Date(at(12).getTime() - minutes * 60_000).toISOString();
      const c = {
        ...baseCandidate,
        frequency,
        todayIntakeMl: intake,
        lastPaceStatus: pace,
        lastReminderSentAt: last,
      };
      expect(evaluatePaceReminder(c, at(12)).shouldSend).toBe(true);
      expect(
        evaluatePaceReminder(
          {
            ...c,
            lastReminderSentAt: new Date(Date.parse(last) + 1000).toISOString(),
          },
          at(12),
        ).shouldSend,
      ).toBe(false);
      expect(
        evaluatePaceReminder({ ...c, reminderCount: cap }, at(12)).reason,
      ).toBe("daily_limit");
    }
  });
  it("uses configured start/end, and delays first supportive check-in from wake", () => {
    expect(
      evaluatePaceReminder({ ...baseCandidate, wakeTime: "13:00" }, at(12))
        .reason,
    ).toBe("outside_notification_window");
    expect(
      evaluatePaceReminder(
        { ...baseCandidate, targetCompletionTime: "11:00" },
        at(12),
      ).reason,
    ).toBe("outside_notification_window");
    expect(
      evaluatePaceReminder({ ...baseCandidate, todayIntakeMl: 200 }, at(9))
        .reason,
    ).toBe("on_track_cooldown");
    expect(
      evaluatePaceReminder(
        {
          ...baseCandidate,
          todayIntakeMl: 800,
          lastHydrationAt: at(11, 30).toISOString(),
        },
        at(12),
      ).reason,
    ).toBe("hydrated_recently");
  });
});

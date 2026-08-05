import { calculateExpectedIntake } from "./expected-intake";
import {
  calculateHydrationStatus,
  type HydrationStatus,
} from "./hydration-status";
import { formatDisplayVolume, parseVolumeUnit } from "@/lib/units/volume";

export const PACE_REMINDER_POLICY = {
  cooldownMinutes: 45,
  endHour: 20,
  maxPerDay: 4,
  recentHydrationMinutes: 20,
  repeatMinutes: 90,
  startHour: 9,
} as const;

export type PaceReminderCandidate = {
  behindEpisode: number;
  goalMl: number | null;
  lastHydrationAt: string | null;
  lastPaceStatus: string | null;
  lastReminderAttemptedAt: string | null;
  lastReminderSentAt: string | null;
  localDate: string;
  normalFillMl: number | null;
  preferredUnit: unknown;
  reminderCount: number;
  targetCompletionTime: string | null;
  timezone: string;
  todayIntakeMl: number;
  wakeTime: string | null;
};

export type PaceReminderDecision = {
  body: string | null;
  paceStatus: HydrationStatus | "outside-window" | "recent-hydration";
  shouldSend: boolean;
  title: string | null;
};

function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return (hour % 24) * 60 + minute;
}

function minutesSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const elapsed = now.getTime() - Date.parse(value);
  return Number.isFinite(elapsed) ? elapsed / 60_000 : null;
}

function latestTimestamp(
  left: string | null,
  right: string | null,
): string | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

export function evaluatePaceReminder(
  candidate: PaceReminderCandidate,
  now: Date,
): PaceReminderDecision {
  const minute = localMinutes(now, candidate.timezone);
  if (
    minute < PACE_REMINDER_POLICY.startHour * 60 ||
    minute >= PACE_REMINDER_POLICY.endHour * 60
  ) {
    return {
      body: null,
      paceStatus: "outside-window",
      shouldSend: false,
      title: null,
    };
  }

  if (
    !candidate.goalMl ||
    !candidate.normalFillMl ||
    !candidate.wakeTime ||
    !candidate.targetCompletionTime
  ) {
    return {
      body: null,
      paceStatus: "not-configured",
      shouldSend: false,
      title: null,
    };
  }

  const recentHydrationMinutes = minutesSince(candidate.lastHydrationAt, now);
  if (
    recentHydrationMinutes !== null &&
    recentHydrationMinutes >= 0 &&
    recentHydrationMinutes < PACE_REMINDER_POLICY.recentHydrationMinutes
  ) {
    return {
      body: null,
      paceStatus: "recent-hydration",
      shouldSend: false,
      title: null,
    };
  }

  const expected = calculateExpectedIntake({
    date: candidate.localDate,
    goalMl: candidate.goalMl,
    now,
    targetCompletionTime: candidate.targetCompletionTime,
    timezone: candidate.timezone,
    wakeTime: candidate.wakeTime,
  });
  const paceStatus = calculateHydrationStatus({
    consumedMl: Math.max(0, candidate.todayIntakeMl),
    expectedMl: expected?.expectedMl ?? null,
    goalMl: candidate.goalMl,
  });

  if (paceStatus !== "behind" || candidate.reminderCount >= 4) {
    return { body: null, paceStatus, shouldSend: false, title: null };
  }

  const lastAttemptOrSend = latestTimestamp(
    candidate.lastReminderAttemptedAt,
    candidate.lastReminderSentAt,
  );
  const elapsed = minutesSince(lastAttemptOrSend, now);
  const isNewEpisode = candidate.lastPaceStatus !== "behind";
  const interval = isNewEpisode
    ? PACE_REMINDER_POLICY.cooldownMinutes
    : PACE_REMINDER_POLICY.repeatMinutes;

  if (elapsed !== null && elapsed < interval) {
    return { body: null, paceStatus, shouldSend: false, title: null };
  }

  const deficitMl = Math.max(
    0,
    (expected?.expectedMl ?? candidate.goalMl) - candidate.todayIntakeMl,
  );
  const normalFillMl = Math.max(1, candidate.normalFillMl);
  const recommendationMl =
    deficitMl >= normalFillMl * 0.75
      ? normalFillMl
      : Math.max(1, Math.round(normalFillMl / 2));
  const unit = parseVolumeUnit(candidate.preferredUnit);
  const amount = `${formatDisplayVolume(recommendationMl, unit)} ${unit}`;

  return {
    body: isNewEpisode
      ? `A gentle check-in: about ${amount} now can help you move toward today’s pace.`
      : `A quick water break of about ${amount} can bring you closer to today’s pace.`,
    paceStatus,
    shouldSend: true,
    title: isNewEpisode ? "HydroPOP check-in 💧" : "Still a little behind 💧",
  };
}

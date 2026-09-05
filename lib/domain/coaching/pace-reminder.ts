import { calculateExpectedIntake } from "./expected-intake";
import {
  calculateHydrationStatus,
  type HydrationStatus,
} from "./hydration-status";
import { calculatePaceRecommendation } from "./pace-recommendation";
import { formatDisplayVolume, parseVolumeUnit } from "@/lib/units/volume";

export const REMINDER_FREQUENCIES = {
  gentle: { behind: 90, onTrack: 240, ahead: 240, maxPerDay: 4 },
  balanced: { behind: 60, onTrack: 180, ahead: 240, maxPerDay: 6 },
  frequent: { behind: 45, onTrack: 120, ahead: 180, maxPerDay: 8 },
} as const;
export type ReminderFrequency = keyof typeof REMINDER_FREQUENCIES;
export const PACE_REMINDER_POLICY = {
  cooldownMinutes: 45,
  recentHydrationMinutes: 20,
  repeatMinutes: 60,
  maxPerDay: 6,
} as const;

export type PaceReminderCandidate = {
  enabled?: boolean;
  activeSubscriptionCount?: number;
  frequency?: ReminderFrequency;
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
  paceStatus: HydrationStatus;
  shouldSend: boolean;
  title: string | null;
  reason: string;
  nextEligibleAt: string | null;
  kind: "behind" | "on_track" | "ahead" | "none";
};

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
  const policy = REMINDER_FREQUENCIES[candidate.frequency ?? "balanced"];
  const expected = calculateExpectedIntake({
    date: candidate.localDate,
    goalMl: candidate.goalMl ?? 0,
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
  const none = (
    reason: string,
    nextEligibleAt: string | null = null,
  ): PaceReminderDecision => ({
    body: null,
    title: null,
    shouldSend: false,
    paceStatus,
    reason,
    nextEligibleAt,
    kind: "none",
  });
  if (candidate.enabled === false) return none("notifications_disabled");
  if (candidate.activeSubscriptionCount === 0)
    return none("no_active_subscription");
  if (!candidate.goalMl) return none("no_goal");
  if (paceStatus === "goal-reached") return none("goal_complete");
  if (!candidate.normalFillMl) return none("no_primary_bottle");
  if (!expected) return none("no_schedule");
  if (
    now.getTime() < Date.parse(expected.wakeAt) ||
    now.getTime() >= Date.parse(expected.targetAt)
  ) {
    return none(
      "outside_notification_window",
      now.getTime() < Date.parse(expected.wakeAt) ? expected.wakeAt : null,
    );
  }
  if (candidate.reminderCount >= policy.maxPerDay) return none("daily_limit");
  const quiet = paceStatus === "behind" ? 20 : 40;
  const recent = minutesSince(candidate.lastHydrationAt, now);
  const last = latestTimestamp(
    candidate.lastReminderAttemptedAt,
    candidate.lastReminderSentAt,
  );
  const interval =
    paceStatus === "behind"
      ? candidate.lastPaceStatus !== "behind"
        ? 45
        : policy.behind
      : paceStatus === "ahead"
        ? policy.ahead
        : policy.onTrack;
  const cadenceAt =
    Date.parse(last ?? expected.wakeAt) +
    (last || paceStatus !== "behind" ? interval : 0) * 60_000;
  const quietAt =
    recent !== null && candidate.lastHydrationAt
      ? Date.parse(candidate.lastHydrationAt) + quiet * 60_000
      : 0;
  const nextAt = new Date(Math.max(cadenceAt, quietAt)).toISOString();
  const afterSend = new Date(
    now.getTime() +
      (paceStatus === "behind"
        ? policy.behind
        : paceStatus === "ahead"
          ? policy.ahead
          : policy.onTrack) *
        60_000,
  ).toISOString();
  if (recent !== null && recent >= 0 && recent < quiet)
    return none("hydrated_recently", nextAt);
  if (now.getTime() < cadenceAt)
    return none(
      paceStatus === "behind"
        ? "behind_cooldown"
        : paceStatus === "ahead"
          ? "ahead_cooldown"
          : "on_track_cooldown",
      nextAt,
    );
  if (paceStatus === "on-track" || paceStatus === "ahead")
    return {
      body:
        paceStatus === "ahead"
          ? "You're ahead of pace. Keep your water nearby."
          : "You're on track today. Keep the momentum going.",
      title: paceStatus === "ahead" ? "Looking good 💧" : "Nice pace 💧",
      paceStatus,
      shouldSend: true,
      kind: paceStatus === "ahead" ? "ahead" : "on_track",
      reason: "eligible",
      nextEligibleAt: afterSend,
    };
  const recommendationMl = calculatePaceRecommendation({
    consumedMl: candidate.todayIntakeMl,
    expectedMl: expected.expectedMl,
    normalFillMl: candidate.normalFillMl,
    status: paceStatus,
  }).amountMl;
  const unit = parseVolumeUnit(candidate.preferredUnit);
  const amount = `${formatDisplayVolume(recommendationMl, unit)} ${unit}`;
  return {
    body: `A water break of about ${amount} can bring you closer to today's pace.`,
    title: "Time for some water 💧",
    paceStatus,
    shouldSend: true,
    kind: "behind",
    reason: "eligible",
    nextEligibleAt: afterSend,
  };
}

export const maximumOfflineAgeMs = 7 * 24 * 60 * 60 * 1_000;
export const maximumFutureSkewMs = 5 * 60 * 1_000;

export type EventWindowError = "EVENT_IN_FUTURE" | "EVENT_TOO_OLD";

export function validateEventWindow(
  occurredAt: Date,
  receivedAt = new Date(),
): EventWindowError | null {
  const ageMs = receivedAt.getTime() - occurredAt.getTime();

  if (ageMs < -maximumFutureSkewMs) {
    return "EVENT_IN_FUTURE";
  }

  if (ageMs > maximumOfflineAgeMs) {
    return "EVENT_TOO_OLD";
  }

  return null;
}

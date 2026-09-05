export type PushFeatureState =
  "not-supported" | "ios-install-required" | "ready";
export function getPushFeatureState(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}): PushFeatureState {
  const ios =
    /iPad|iPhone|iPod/.test(input.userAgent) ||
    (input.platform === "MacIntel" && input.maxTouchPoints > 1);
  if (ios && !input.standalone) return "ios-install-required";
  return input.hasServiceWorker && input.hasPushManager && input.hasNotification
    ? "ready"
    : "not-supported";
}

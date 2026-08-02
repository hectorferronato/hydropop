import type { HydrationSuccessPayload } from "@/lib/contracts/hydration-success";

import { playHydropopChime, prepareHydropopChime } from "./hydropop-chime";
import { readSoundEffectsPreference } from "./sound-effects-preference";

export type PreparedHydrationFeedback = {
  soundEnabled: boolean;
};

export function prepareHydrationFeedback(): PreparedHydrationFeedback {
  const soundEnabled = readSoundEffectsPreference();

  if (soundEnabled) {
    prepareHydropopChime();
  }

  return { soundEnabled };
}

export function completeHydrationFeedback(
  prepared: PreparedHydrationFeedback,
  result: HydrationSuccessPayload,
): void {
  if (prepared.soundEnabled && result.isNew) {
    playHydropopChime();
  }
}

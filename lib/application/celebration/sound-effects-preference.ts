export const soundEffectsStorageKey = "hydropop:preferences:sound-effects:v1";

export function readSoundEffectsPreference(
  storage: Pick<Storage, "getItem"> | null = typeof window === "undefined"
    ? null
    : window.localStorage,
): boolean {
  try {
    return storage?.getItem(soundEffectsStorageKey) !== "off";
  } catch {
    return true;
  }
}

export function writeSoundEffectsPreference(
  enabled: boolean,
  storage: Pick<Storage, "setItem"> | null = typeof window === "undefined"
    ? null
    : window.localStorage,
): void {
  try {
    storage?.setItem(soundEffectsStorageKey, enabled ? "on" : "off");
  } catch {
    // Storage availability must not affect hydration or visual feedback.
  }
}

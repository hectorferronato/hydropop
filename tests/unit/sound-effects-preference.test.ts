import { describe, expect, it, vi } from "vitest";

import {
  readSoundEffectsPreference,
  soundEffectsStorageKey,
  writeSoundEffectsPreference,
} from "@/lib/application/celebration/sound-effects-preference";

describe("sound effects preference", () => {
  it("defaults to enabled when no value exists", () => {
    expect(readSoundEffectsPreference({ getItem: () => null })).toBe(true);
  });

  it("persists and reads explicit on/off values", () => {
    const setItem = vi.fn();

    writeSoundEffectsPreference(false, { setItem });
    expect(setItem).toHaveBeenCalledWith(soundEffectsStorageKey, "off");
    expect(readSoundEffectsPreference({ getItem: () => "off" })).toBe(false);
    expect(readSoundEffectsPreference({ getItem: () => "on" })).toBe(true);
  });

  it("fails safely when browser storage is unavailable", () => {
    expect(
      readSoundEffectsPreference({
        getItem: () => {
          throw new Error("storage blocked");
        },
      }),
    ).toBe(true);
    expect(() =>
      writeSoundEffectsPreference(true, {
        setItem: () => {
          throw new Error("storage blocked");
        },
      }),
    ).not.toThrow();
  });
});

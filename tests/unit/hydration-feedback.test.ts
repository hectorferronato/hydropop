import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  playHydropopChime: vi.fn(),
  prepareHydropopChime: vi.fn(),
  readSoundEffectsPreference: vi.fn(() => true),
}));

vi.mock("@/lib/application/celebration/hydropop-chime", () => ({
  playHydropopChime: mocks.playHydropopChime,
  prepareHydropopChime: mocks.prepareHydropopChime,
}));
vi.mock("@/lib/application/celebration/sound-effects-preference", () => ({
  readSoundEffectsPreference: mocks.readSoundEffectsPreference,
}));

import {
  completeHydrationFeedback,
  prepareHydrationFeedback,
} from "@/lib/application/celebration/hydration-feedback";
import type { HydrationSuccessPayload } from "@/lib/contracts/hydration-success";

const success: HydrationSuccessPayload = {
  amountRecordedMl: 650,
  completedBottleCount: 1,
  goalMl: 2_130,
  goalPercentage: 30.5,
  isNew: true,
  semantic: "full",
  updatedDailyTotalMl: 650,
};

describe("shared hydration feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readSoundEffectsPreference.mockReturnValue(true);
  });

  it("prepares Web Audio from the action gesture and plays after new success", () => {
    const prepared = prepareHydrationFeedback();

    expect(mocks.prepareHydropopChime).toHaveBeenCalledOnce();
    expect(mocks.playHydropopChime).not.toHaveBeenCalled();

    completeHydrationFeedback(prepared, success);
    expect(mocks.playHydropopChime).toHaveBeenCalledOnce();
  });

  it("does not play for idempotent replays", () => {
    const prepared = prepareHydrationFeedback();
    completeHydrationFeedback(prepared, { ...success, isNew: false });

    expect(mocks.playHydropopChime).not.toHaveBeenCalled();
  });

  it("does not prepare or play when sound is off", () => {
    mocks.readSoundEffectsPreference.mockReturnValue(false);
    const prepared = prepareHydrationFeedback();
    completeHydrationFeedback(prepared, success);

    expect(mocks.prepareHydropopChime).not.toHaveBeenCalled();
    expect(mocks.playHydropopChime).not.toHaveBeenCalled();
  });
});

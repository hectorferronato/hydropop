import { describe, expect, it, vi } from "vitest";

import {
  loadOnboardingSnapshot,
  type OnboardingSnapshotDataSource,
  SetupReadError,
} from "@/lib/infrastructure/supabase/onboarding";

const userId = "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c";

function createPersistedDataSource() {
  const getProfile = vi.fn<OnboardingSnapshotDataSource["getProfile"]>(
    async () => ({
      data: {
        display_name: "Beatriz",
        preferred_unit: "oz",
        target_completion_time: "20:15:00",
        timezone: "America/New_York",
        wake_time: "06:30:00",
      },
      error: null,
    }),
  );
  const getPrimaryBottle = vi.fn<
    OnboardingSnapshotDataSource["getPrimaryBottle"]
  >(async () => ({
    data: {
      brand: "Owala",
      capacity_ml: 710,
      id: "3a8d1d53-f6ab-4cc7-86f1-5a78382e3680",
      is_primary: true,
      model: "FreeSip",
      name: "Work bottle",
      typical_fill_ml: 650,
    },
    error: null,
  }));
  const getActiveGoal = vi.fn<OnboardingSnapshotDataSource["getActiveGoal"]>(
    async () => ({
      data: {
        daily_goal_ml: 2130,
        effective_from: "2026-07-24",
        id: "e60b6ab3-6697-4edc-8287-61219a323fa7",
        target_completion_time: "20:15:00",
      },
      error: null,
    }),
  );
  const dataSource = {
    getActiveGoal,
    getPrimaryBottle,
    getProfile,
  } satisfies OnboardingSnapshotDataSource;

  return { dataSource, getActiveGoal, getPrimaryBottle, getProfile };
}

describe("onboarding snapshot loading", () => {
  it("reloads the saved profile, primary bottle, and active goal", async () => {
    const { dataSource } = createPersistedDataSource();

    const snapshot = await loadOnboardingSnapshot(
      dataSource,
      userId,
      new Date("2026-07-25T01:30:00.000Z"),
    );

    expect(snapshot.profile?.display_name).toBe("Beatriz");
    expect(snapshot.bottle?.name).toBe("Work bottle");
    expect(snapshot.bottle?.typical_fill_ml).toBe(650);
    expect(snapshot.goal?.daily_goal_ml).toBe(2130);
    expect(snapshot.isComplete).toBe(true);
  });

  it("uses the authenticated user and that user's local date", async () => {
    const { dataSource, getActiveGoal, getPrimaryBottle, getProfile } =
      createPersistedDataSource();

    await loadOnboardingSnapshot(
      dataSource,
      userId,
      new Date("2026-07-25T01:30:00.000Z"),
    );

    expect(getProfile).toHaveBeenCalledWith(userId);
    expect(getPrimaryBottle).toHaveBeenCalledWith(userId);
    expect(getActiveGoal).toHaveBeenCalledWith(userId, "2026-07-24");
  });

  it("surfaces query failures instead of returning fallback defaults", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const dataSource = {
      getActiveGoal: vi.fn(async () => ({ data: null, error: null })),
      getPrimaryBottle: vi.fn(async () => ({ data: null, error: null })),
      getProfile: vi.fn(async () => ({
        data: null,
        error: { code: "42501" },
      })),
    } satisfies OnboardingSnapshotDataSource;

    await expect(loadOnboardingSnapshot(dataSource, userId)).rejects.toThrow(
      SetupReadError,
    );
    expect(dataSource.getPrimaryBottle).not.toHaveBeenCalled();
    expect(dataSource.getActiveGoal).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "[HydroPOP] Setup profile query failed.",
      { code: "42501" },
    );

    consoleError.mockRestore();
  });

  it("surfaces primary-bottle query failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { dataSource } = createPersistedDataSource();
    dataSource.getPrimaryBottle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116" },
    });

    await expect(loadOnboardingSnapshot(dataSource, userId)).rejects.toThrow(
      "Unable to load the persisted setup primary bottle.",
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[HydroPOP] Setup primary bottle query failed.",
      { code: "PGRST116" },
    );

    consoleError.mockRestore();
  });

  it("surfaces active-goal query failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { dataSource } = createPersistedDataSource();
    dataSource.getActiveGoal.mockResolvedValue({
      data: null,
      error: { code: "57014" },
    });

    await expect(loadOnboardingSnapshot(dataSource, userId)).rejects.toThrow(
      "Unable to load the persisted setup active goal.",
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[HydroPOP] Setup active goal query failed.",
      { code: "57014" },
    );

    consoleError.mockRestore();
  });
});

import { describe, expect, it } from "vitest";

import { validateEventWindow } from "@/lib/domain/hydration/event-window";

const receivedAt = new Date("2026-07-28T12:00:00.000Z");

describe("offline hydration event window", () => {
  it("accepts an event exactly seven days old", () => {
    expect(
      validateEventWindow(new Date("2026-07-21T12:00:00.000Z"), receivedAt),
    ).toBeNull();
  });

  it("rejects an event older than seven days", () => {
    expect(
      validateEventWindow(new Date("2026-07-21T11:59:59.999Z"), receivedAt),
    ).toBe("EVENT_TOO_OLD");
  });

  it("accepts five minutes of clock skew", () => {
    expect(
      validateEventWindow(new Date("2026-07-28T12:05:00.000Z"), receivedAt),
    ).toBeNull();
  });

  it("rejects timestamps more than five minutes ahead", () => {
    expect(
      validateEventWindow(new Date("2026-07-28T12:05:00.001Z"), receivedAt),
    ).toBe("EVENT_IN_FUTURE");
  });
});

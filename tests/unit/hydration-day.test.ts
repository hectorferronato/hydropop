import { describe, expect, it } from "vitest";

import {
  getDateInTimezone,
  isValidIanaTimezone,
} from "@/lib/domain/hydration/hydration-day";

describe("hydration day timezone handling", () => {
  it("uses the user's IANA timezone to determine the date", () => {
    const instant = new Date("2026-07-25T02:00:00.000Z");

    expect(getDateInTimezone("America/New_York", instant)).toBe("2026-07-24");
    expect(getDateInTimezone("Asia/Tokyo", instant)).toBe("2026-07-25");
  });

  it("rejects invalid timezone identifiers", () => {
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
    expect(isValidIanaTimezone("Not/A_Timezone")).toBe(false);
  });
});

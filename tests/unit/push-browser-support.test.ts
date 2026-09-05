import { describe, expect, it } from "vitest";
import { getPushFeatureState } from "@/lib/application/push/browser-support";
const base = {
  userAgent: "iPhone Safari",
  platform: "iPhone",
  maxTouchPoints: 5,
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: false,
  hasNotification: false,
};
describe("mobile push capability detection", () => {
  it("guides ordinary iOS tabs to installation before checking missing APIs", () =>
    expect(getPushFeatureState(base)).toBe("ios-install-required"));
  it("supports installed iPhone PWAs", () =>
    expect(
      getPushFeatureState({
        ...base,
        standalone: true,
        hasPushManager: true,
        hasNotification: true,
      }),
    ).toBe("ready"));
  it("recognizes iPad desktop user agents", () =>
    expect(
      getPushFeatureState({
        ...base,
        userAgent: "Macintosh Safari",
        platform: "MacIntel",
      }),
    ).toBe("ios-install-required"));
  it("does not misclassify desktop Macs", () =>
    expect(
      getPushFeatureState({
        ...base,
        userAgent: "Macintosh Chrome",
        platform: "MacIntel",
        maxTouchPoints: 0,
        hasPushManager: true,
        hasNotification: true,
      }),
    ).toBe("ready"));
});

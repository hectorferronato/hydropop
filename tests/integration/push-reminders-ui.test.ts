import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const settings = readFileSync(
  join(root, "app/(private)/settings/notifications/notification-settings.tsx"),
  "utf8",
);
const settingsPage = readFileSync(
  join(root, "app/(private)/settings/notifications/page.tsx"),
  "utf8",
);
const todayPage = readFileSync(
  join(root, "app/(private)/today/page.tsx"),
  "utf8",
);
const recordWater = readFileSync(
  join(root, "app/(private)/today/record-water.tsx"),
  "utf8",
);
const serviceWorker = readFileSync(join(root, "public/sw.js"), "utf8");
const rootLayout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const profile = readFileSync(
  join(root, "app/(private)/profile/page.tsx"),
  "utf8",
);
const testRoute = readFileSync(
  join(root, "app/api/v1/push-notifications/test/route.ts"),
  "utf8",
);

describe("Web Push PWA and notification experience", () => {
  it("extends one globally registered service worker without requesting permission", () => {
    expect(rootLayout).toContain("<PwaServiceWorker />");
    expect(rootLayout).toContain('manifest: "/manifest.webmanifest"');
    expect(rootLayout).not.toContain("requestPermission");
    expect(serviceWorker).toContain('self.addEventListener("push"');
    expect(serviceWorker).toContain(
      'self.addEventListener("notificationclick"',
    );
  });

  it("validates bounded payloads and only opens the exact same-origin target", () => {
    expect(serviceWorker).toContain(
      'const SAFE_TARGET = "/today?record=1&source=push"',
    );
    expect(serviceWorker).toContain('value?.kind === "pace-reminder"');
    expect(serviceWorker).toContain('value?.kind === "test"');
    expect(serviceWorker).toContain("value.title.length > 80");
    expect(serviceWorker).toContain("value.body.length > 180");
    expect(serviceWorker).toContain("new URL(target, self.location.origin)");
    expect(serviceWorker).not.toMatch(/https?:\/\/(?!www\.w3\.org)/u);
  });

  it("handles unsupported, iOS install, denied, and enabled device states", () => {
    expect(settings).toContain('"not-supported"');
    expect(settings).toContain('"ios-install-required"');
    expect(settings).toContain('permission === "denied"');
    expect(settings).toMatch(/Add to Home\s+Screen/u);
    expect(settings).toContain("Open as Web App");
    expect(settings).toContain("Install app or Add to Home screen");
    expect(settings).toContain("Enable reminders");
    expect(settings).toContain("Disable this device");
  });

  it("requests permission only from the explicit enable action", () => {
    const enableStart = settings.indexOf("async function enableThisDevice");
    const disableStart = settings.indexOf("async function disableThisDevice");
    const enable = settings.slice(enableStart, disableStart);
    expect(enable).toContain("Notification.requestPermission()");
    expect(settings.slice(0, enableStart)).not.toContain("requestPermission()");
  });

  it("supports current-device testing, per-device disable, and overall pause", () => {
    expect(settings).toContain('"/api/v1/push-notifications/test"');
    expect(settings).toContain('"/api/v1/push-subscriptions", "DELETE"');
    expect(settings).toContain("Pause all reminders");
    expect(settings).toContain("Resume reminders");
    expect(settings).toContain("Active devices");
    expect(testRoute).toContain('target: "/today"');
    expect(testRoute).toContain("`hydropop-test-${randomUUID()}`");
    expect(testRoute).not.toContain("hydration_reminder_state");
  });

  it("loads dynamically with noindex metadata and is linked from Profile", () => {
    expect(settingsPage).toContain("await connection()");
    expect(settingsPage).toContain("follow: false, index: false");
    expect(settingsPage).toContain("requireAllowedUser");
    expect(profile).toContain('href: "/settings/notifications"');
  });

  it("opens the existing Today chooser and normalizes the push deep link without writing", () => {
    expect(todayPage).toContain('readSearchValue(parameters.record) === "1"');
    expect(todayPage).toContain(
      'readSearchValue(parameters.source) === "push"',
    );
    expect(todayPage).toContain("initiallyOpen={openRecordWater}");
    expect(recordWater).toContain(
      'window.history.replaceState(null, "", "/today")',
    );

    const deepLinkEffect = recordWater.slice(
      recordWater.indexOf("if (initiallyOpen)"),
      recordWater.indexOf("function close()"),
    );
    expect(deepLinkEffect).not.toContain("fetch(");
    expect(deepLinkEffect).not.toContain("record(");
  });

  it("keeps notification layouts mobile-safe and copy privacy-limited", () => {
    expect(settings).toContain("min-h-11");
    expect(settings).toContain("flex flex-wrap");
    expect(settings).not.toContain("overflow-x-auto");
    expect(settings).toContain(
      "do not contain email, timezone, bottle identifiers",
    );
  });
});

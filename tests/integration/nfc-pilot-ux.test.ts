import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const manager = readFileSync(
  resolve(root, "app/(private)/device/nfc/nfc-manager.tsx"),
  "utf8",
);
const scanPage = readFileSync(
  resolve(root, "app/t/[identifier]/page.tsx"),
  "utf8",
);
const confirmation = readFileSync(
  resolve(root, "app/t/[identifier]/nfc-confirmation.tsx"),
  "utf8",
);
const devicePage = readFileSync(
  resolve(root, "app/(private)/device/page.tsx"),
  "utf8",
);
const bottleSettings = readFileSync(
  resolve(root, "app/(private)/settings/bottle/bottle-form.tsx"),
  "utf8",
);
const refreshOnFocus = readFileSync(
  resolve(root, "components/refresh-on-focus.tsx"),
  "utf8",
);

describe("NFC pilot experience contracts", () => {
  it("prevents duplicate creation and replaces the completed create action", () => {
    expect(manager).toContain("createSubmissionLockedRef.current");
    expect(manager).toContain("creationComplete");
    expect(manager).toContain('setPending("create")');
    expect(manager).toContain("disabled={");
    expect(manager).toContain("Create another tag");
    expect(manager).toContain("NFC tag created");
  });

  it("scrolls and focuses the one-time result after creation or rotation", () => {
    expect(manager).toContain("scrollIntoView({");
    expect(manager).toContain("focus({ preventScroll: true })");
    expect(manager).toContain("tabIndex={-1}");
    expect(manager).toContain(
      "Copy the secure URL now. It cannot be shown again.",
    );
  });

  it("provides visible and accessible copy success and failure feedback", () => {
    expect(manager).toContain('"✓ Copied!"');
    expect(manager).toContain('aria-live="polite"');
    expect(manager).toContain("2_000");
    expect(manager).toContain(
      "Could not copy. Select and copy the URL manually.",
    );
    expect(manager.match(/<CopyUrlButton/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it("distinguishes physical capacity from credited completion amount", () => {
    for (const source of [manager, scanPage, devicePage]) {
      expect(source).toContain("Bottle capacity");
      expect(source).toContain("Records per completion");
    }

    expect(bottleSettings).toContain("Physical bottle capacity");
    expect(bottleSettings).toContain("Records per completion");
    expect(scanPage).toContain("uses full capacity");
  });

  it("uses continuation-oriented scan wording", () => {
    expect(scanPage).toContain('"Completed a bottle?"');
    expect(scanPage).toContain('"Completed another bottle?"');
    expect(scanPage).toContain("This records your normal fill amount of");
    expect(scanPage).toMatch(/Partial\s+fills must be corrected in the app\./u);
    expect(scanPage).not.toContain("Finished your bottle?");
  });

  it("navigates to refreshed Today data after displaying the updated summary", () => {
    expect(confirmation).toContain("result.daySummary.consumedMl");
    expect(confirmation).toContain('router.push("/today")');
    expect(confirmation).toContain("router.refresh()");
  });

  it("refreshes Today once on focus or visibility without polling", () => {
    expect(refreshOnFocus).toContain(
      'window.addEventListener("focus", refreshVisiblePage)',
    );
    expect(refreshOnFocus).toContain(
      'document.addEventListener("visibilitychange", refreshVisiblePage)',
    );
    expect(refreshOnFocus).toContain("duplicateFocusEventWindowMs = 1_000");
    expect(refreshOnFocus).not.toContain("setInterval");
    expect(refreshOnFocus).not.toMatch(/3_?000/u);
  });
});

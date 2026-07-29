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
const refreshController = readFileSync(
  resolve(root, "components/today-refresh-controller.tsx"),
  "utf8",
);
const refreshPolicy = readFileSync(
  resolve(root, "lib/application/refresh/visible-refresh-controller.ts"),
  "utf8",
);

describe("NFC pilot experience contracts", () => {
  it("prevents duplicate creation and replaces the completed create action", () => {
    expect(manager).toContain("createSubmissionLockedRef.current");
    expect(manager).toContain("creationComplete");
    expect(manager).toContain('setPending("create")');
    expect(manager).toContain("Create another tag");
    expect(manager).toContain("NFC tag created");
  });

  it("focuses the result only after tag creation", () => {
    expect(manager).toContain("scrollIntoView({");
    expect(manager).toContain("focus({ preventScroll: true })");
    expect(manager).toContain("tabIndex={-1}");
    expect(manager).not.toContain("Rotate secure URL");
    expect(manager).not.toContain("credential.secureUrl");
    expect(manager).not.toContain("Copy secure URL");
    expect(manager).not.toContain("displayed once");
  });

  it("provides visible and accessible copy feedback while keeping the URL selectable", () => {
    expect(manager).toContain('"Copied! ✓"');
    expect(manager).toContain('aria-live="polite"');
    expect(manager).toContain("2_000");
    expect(manager).toContain("select-all");
    expect(manager).toContain(
      "Could not copy. Select and copy the URL manually.",
    );
  });

  it("gives NFC edits stable save feedback and disables unchanged saves", () => {
    expect(manager).toContain("savedTagId");
    expect(manager).toContain('"Saved ✓"');
    expect(manager).toContain('"No changes"');
    expect(manager).toContain("!hasChanges");
    expect(manager).toContain("setEditDrafts");
    expect(manager).toContain("updateSubmissionLocksRef.current.has(tag.id)");
    expect(manager).toContain("2_000");
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

  it("offers full, half, Today, and cancel scan actions without a cancel mutation", () => {
    expect(confirmation).toContain('"Record one bottle"');
    expect(confirmation).toContain("`Record half —");
    expect(confirmation).toContain('"View Today"');
    expect(confirmation).toContain('"Cancel"');
    expect(confirmation).toContain("submissionLockRef.current");
    expect(confirmation).toContain("router.back()");
    expect(confirmation).toContain('router.push("/today")');

    const cancelBody = confirmation.slice(
      confirmation.indexOf("function cancel()"),
      confirmation.indexOf("async function submit"),
    );
    expect(cancelBody).not.toContain("fetch(");
  });

  it("sends only the semantic completion action and server-safe request fields", () => {
    const requestBody = confirmation.slice(
      confirmation.indexOf("body: JSON.stringify({"),
      confirmation.indexOf('headers: { "content-type"'),
    );

    expect(requestBody).toContain("action,");
    expect(requestBody).toContain("idempotencyKey:");
    expect(requestBody).toContain("occurredAt:");
    expect(requestBody).toContain("identifier,");
    expect(requestBody).not.toContain("volumeMl");
    expect(requestBody).not.toContain("bottleId");
    expect(requestBody).not.toContain("userId");
  });

  it("navigates to refreshed Today data after displaying the updated summary", () => {
    expect(confirmation).toContain("result.daySummary.consumedMl");
    expect(confirmation).toContain('router.push("/today")');
    expect(confirmation).toContain("router.refresh()");
  });

  it("uses bounded, visibility-aware Today refreshes with cleanup", () => {
    expect(refreshController).toContain('fetch("/api/v1/dashboard/today"');
    expect(refreshController).toContain('cache: "no-store"');
    expect(refreshPolicy).toContain("todayRefreshIntervalMs = 5_000");
    expect(refreshPolicy).toContain("isVisible()");
    expect(refreshPolicy).toContain("isOnline()");
    expect(refreshPolicy).toContain("inFlight");
    expect(refreshPolicy).toContain("clearInterval");
    expect(refreshPolicy).toContain("removeWindowListener");
    expect(refreshPolicy).toContain("removeDocumentListener");
  });

  it("keeps narrow scan layouts within the viewport", () => {
    expect(scanPage).toContain("min-h-dvh");
    expect(scanPage).toContain("max-w-full");
    expect(scanPage).toContain("overflow-x-clip");
    expect(scanPage).toContain("safe-area-inset-bottom");
    expect(confirmation).toContain("min-w-0");
  });
});

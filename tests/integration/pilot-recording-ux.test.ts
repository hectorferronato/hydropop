import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const loginAction = read("app/auth/login/actions.ts");
const setupAction = read("app/(private)/setup/actions.ts");
const scanPage = read("app/t/[identifier]/page.tsx");
const activationCard = read("app/t/[identifier]/pilot-activation-card.tsx");
const activationRoute = read("app/api/v1/nfc-tags/pilot/activate/route.ts");
const manualPanel = read("app/(private)/today/record-water.tsx");
const manualRoute = read("app/api/v1/hydration-events/manual/route.ts");
const manualContract = read("lib/contracts/manual-hydration.ts");
const nfcConfirmation = read("app/t/[identifier]/nfc-confirmation.tsx");
const celebration = read("components/hydration-success-celebration.tsx");
const preference = read("components/sound-effects-preference.tsx");
const globalStyles = read("app/globals.css");

describe("pilot onboarding and recording UX contracts", () => {
  it("preserves /t/pilot through login, incomplete setup, and final redirect", () => {
    expect(loginAction).toContain("createSetupPath(destination");
    expect(loginAction).toContain("isPilotNfcDestination(destination)");
    expect(scanPage).toContain("new URLSearchParams({ next: destination })");
    expect(scanPage).toContain('setupParameters.set("mode", "complete")');
    expect(setupAction).toContain("redirect(destination)");
  });

  it("generates and hashes a pilot credential only on the server setup action", () => {
    expect(setupAction).toContain("issueNfcCredential");
    expect(setupAction).toContain("pilotTokenHash");
    expect(setupAction).not.toContain("rawToken");
  });

  it("keeps GET /t/pilot read-only and activation explicit", () => {
    expect(scanPage).toContain("<PilotActivationCard />");
    expect(scanPage).not.toContain("activate_pilot_nfc_tag");
    expect(scanPage).not.toContain("insert(");
    expect(activationCard).toContain('method: "POST"');
    expect(activationCard).toContain("Activate pilot tag");
    expect(activationCard).toContain("submissionLockRef.current");
    expect(activationRoute).toContain('rpc("activate_pilot_nfc_tag"');
  });

  it("submits only semantic manual input from an accessible modal", () => {
    const body = manualPanel.slice(
      manualPanel.indexOf("body: JSON.stringify(request)"),
      manualPanel.indexOf('headers: { "content-type"'),
    );

    expect(manualPanel).toContain("Record water");
    expect(manualPanel).toContain('role="dialog"');
    expect(manualPanel).toContain('aria-modal="true"');
    expect(manualPanel).toContain('event.key === "Escape"');
    expect(manualPanel).toContain("focusableSelector");
    expect(manualPanel).toContain("triggerRef.current?.focus()");
    expect(body).not.toContain("bottleId");
    expect(body).not.toContain("volumeMl");
    expect(body).not.toContain("userId");
    expect(manualContract).toContain(".strict()");
    expect(manualRoute).toContain("recordManualHydration");
    expect(manualRoute).toContain("revalidateHydrationViews()");
    expect(manualRoute).not.toContain("mark_nfc_tag_confirmed");
    expect(manualRoute).not.toContain("last_scanned_at");
  });

  it("shares new-event-only feedback between NFC and manual recording", () => {
    for (const source of [nfcConfirmation, manualPanel]) {
      expect(source).toContain("prepareHydrationFeedback()");
      expect(source).toContain("completeHydrationFeedback(");
      expect(source).toContain("HydrationSuccessCelebration");
    }

    expect(nfcConfirmation.indexOf("prepareHydrationFeedback()")).toBeLessThan(
      nfcConfirmation.indexOf('fetch("/api/v1/nfc-tags/complete"'),
    );
    expect(manualPanel.indexOf("prepareHydrationFeedback()")).toBeLessThan(
      manualPanel.indexOf('fetch("/api/v1/hydration-events/manual"'),
    );
  });

  it("provides one accessible celebration with reduced-motion behavior", () => {
    expect(celebration).toContain('aria-hidden="true"');
    expect(celebration).toContain('aria-live="polite"');
    expect(celebration).toContain('role="status"');
    expect(celebration).toContain("window.setTimeout");
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalStyles).toContain(".hydration-particles");
  });

  it("exposes an accessible local-only sound switch", () => {
    expect(preference).toContain('role="switch"');
    expect(preference).toContain("aria-checked={enabled}");
    expect(preference).toContain("Sound effects");
    expect(preference).toContain("writeSoundEffectsPreference");
  });
});

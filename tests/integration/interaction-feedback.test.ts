import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("shared interaction feedback", () => {
  it("shows route-level feedback and clears it when navigation settles", () => {
    const provider = source("components/navigation-feedback.tsx");
    const navigation = source("components/app-navigation.tsx");
    const appShell = source("components/app-shell.tsx");

    expect(appShell).toContain("<NavigationFeedbackProvider>");
    expect(provider).toContain("onClickCapture");
    expect(provider).toContain('role="status"');
    expect(provider).toContain('aria-label="Loading page"');
    expect(provider).toContain('"data-navigation-pending"');
    expect(provider).toContain('setAttribute("aria-busy", "true")');
    expect(provider).toContain("setPendingHref(null)");
    expect(provider).toContain("renderedLocationRef.current");
    expect(provider).toContain("12_000");
    expect(navigation).toContain("pendingHref === item.href");
    expect(navigation).toContain("<ActionSpinner");
  });

  it("provides a private-route loading skeleton", () => {
    const loading = source("app/(private)/loading.tsx");
    const scanLoading = source("app/t/[identifier]/loading.tsx");
    const skeleton = source("components/page-loading-skeleton.tsx");

    expect(loading).toContain("<PageLoadingSkeleton");
    expect(scanLoading).toContain("<PageLoadingSkeleton");
    expect(skeleton).toContain('role="status"');
    expect(skeleton).toContain("Loading…");
    expect(skeleton).toContain("animate-pulse");
  });

  it("applies visible hover, focus, pressed, and disabled states globally", () => {
    const styles = source("app/globals.css");

    expect(styles).toContain(":focus-visible");
    expect(styles).toContain(":active");
    expect(styles).toContain("transform: scale(0.975)");
    expect(styles).toContain("button:disabled");
    expect(styles).toContain("@media (hover: hover)");
  });

  it("shows progress for login and settings submissions", () => {
    const login = source("app/auth/login/login-form.tsx");
    const settings = source(
      "app/(private)/settings/settings-form-controls.tsx",
    );

    for (const form of [login, settings]) {
      expect(form).toContain("ActionSpinner");
      expect(form).toContain("pending");
      expect(form).toContain("disabled={pending}");
    }
  });
});

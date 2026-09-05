import { expect, test } from "@playwright/test";
import { build } from "esbuild";

let script: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import {createRoot} from 'react-dom/client';
      import {EventTimeline} from './components/hydration/event-timeline';
      import {original} from './tests/fixtures/recordings';
      createRoot(document.getElementById('root')).render(<EventTimeline events={[{...original,creditedVolumeMl:887,isEffective:true}]} timezone="America/New_York" unit="ml"/>);`,
      loader: "tsx",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "test-router",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "router",
            namespace: "test",
          }));
          builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents:
              "export const useRouter = () => ({refresh() { window.dispatchEvent(new Event('test-refresh')); }});",
            loader: "js",
          }));
        },
      },
    ],
  });
  script = result.outputFiles[0]!.text;
});
test.beforeEach(async ({ page }) => {
  await page.goto("/auth/login");
  const css = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  await page.route("**/__recording-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${css}</head><body><main id="root" style="max-width:500px;margin:16px"></main><script>${script}</script></body></html>`,
    }),
  );
  await page.goto("/__recording-fixture");
});

test("source, keyboard menu, dialog focus, Escape and narrow-screen layout", async ({
  page,
}) => {
  await expect(page.getByText(/Physical button/u)).toBeVisible();
  const options = page.getByRole("button", { name: /Recording options/u });
  await options.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "Edit", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Edit recording" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Amount (ml)")).toBeFocused();
  await page.getByRole("button", { name: "Save changes" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Amount (ml)")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(options).toBeFocused();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await options.click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const box = await dialog.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    if (viewport.width === 320)
      await page.screenshot({ path: test.info().outputPath("edit-320.png") });
    await page.getByRole("button", { name: "Cancel" }).click();
  }
});

test("edit submits explicitly, displays validation and prevents duplicate submits", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/v1/hydration-events/change", async (route) => {
    requests.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        data: null,
        error: {
          code: "INVALID_INPUT",
          message: "Review the amount and date.",
        },
      }),
    });
  });
  await page.getByRole("button", { name: /Recording options/u }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page.getByLabel("Amount (ml)").fill("800");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-04");
  await page.getByLabel("Time", { exact: true }).fill("21:45:00");
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Review the amount");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    action: "edit",
    amount: 800,
    date: "2026-09-04",
    time: "21:45:00",
    unit: "ml",
  });
  expect(requests[0]).not.toHaveProperty("source");
  expect(requests[0]).not.toHaveProperty("userId");
});

test("removal requires confirmation and an uncertain retry reuses its key", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/v1/hydration-events/change", async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: { ok: true }, error: null }),
    });
  });
  await page.getByRole("button", { name: /Recording options/u }).click();
  await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Remove recording?" }),
  ).toBeVisible();
  await expect(
    page.getByText(/totals and progress will be recalculated/u),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page
    .getByRole("button", { name: "Remove recording", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Retry");
  await page.getByRole("button", { name: "Retry change" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  await expect(
    page.getByRole("list", { name: "Hydration recordings" }),
  ).toBeFocused();
});

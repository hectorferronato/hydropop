import { expect, test } from "@playwright/test";

test("renders login and explains an unauthorized account", async ({ page }) => {
  await page.goto("/auth/login?next=%2Ft%2FAbcdefghijklmnop_1234");

  await expect(
    page.getByRole("heading", { name: "Sign in to HydroPOP" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("There is no public sign-up.")).toBeVisible();

  await page.getByLabel("Email").fill("not-allowed@example.com");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("heading", { name: "This account isn’t approved yet" }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/auth\/unauthorized\?next=%2Ft%2FAbcdefghijklmnop_1234$/u,
  );
  await expect(
    page.getByRole("link", { name: "Try another email" }),
  ).toHaveAttribute("href", "/auth/login?next=%2Ft%2FAbcdefghijklmnop_1234");
});

test("protects the settings route and preserves it through login", async ({
  page,
}) => {
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "Sign in to HydroPOP" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fsettings$/u);
});

test("returns stable unauthenticated errors from hydration APIs", async ({
  request,
}) => {
  const todayResponse = await request.get("/api/v1/dashboard/today");
  const calendarResponse = await request.get("/api/v1/calendar?month=2026-07");
  const eventResponse = await request.post("/api/v1/hydration-events", {
    data: {
      bottleId: "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0",
      eventType: "bottle_completed",
      idempotencyKey: "playwright-event-key",
      occurredAt: new Date().toISOString(),
      source: "simulator",
    },
  });

  expect(todayResponse.status()).toBe(401);
  expect(calendarResponse.status()).toBe(401);
  expect(eventResponse.status()).toBe(401);
  await expect(todayResponse.json()).resolves.toMatchObject({
    data: null,
    error: { code: "UNAUTHENTICATED" },
  });
});

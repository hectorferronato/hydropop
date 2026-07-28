import { expect, test } from "@playwright/test";

const nfcToken = "A".repeat(43);

test("renders login and explains an unauthorized account", async ({ page }) => {
  await page.goto(`/auth/login?next=%2Ft%2F${nfcToken}`);

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
    new RegExp(`/auth/unauthorized\\?next=%2Ft%2F${nfcToken}$`, "u"),
  );
  await expect(
    page.getByRole("link", { name: "Try another email" }),
  ).toHaveAttribute("href", `/auth/login?next=%2Ft%2F${nfcToken}`);
});

test("preserves the exact NFC destination through unauthenticated scan redirect", async ({
  page,
}) => {
  await page.goto(`/t/${nfcToken}`);

  await expect(
    page.getByRole("heading", { name: "Sign in to HydroPOP" }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/auth/login\\?next=%2Ft%2F${nfcToken}$`, "u"),
  );
  await expect(page.locator('input[name="next"]')).toHaveValue(
    `/t/${nfcToken}`,
  );
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
  const nfcListResponse = await request.get("/api/v1/nfc-tags");
  const nfcCreateResponse = await request.post("/api/v1/nfc-tags", {
    data: {
      bottleId: "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0",
      label: "Test",
    },
  });
  const nfcCompletionResponse = await request.post(
    "/api/v1/nfc-tags/complete",
    {
      data: {
        idempotencyKey: "playwright-nfc-event-key",
        occurredAt: new Date().toISOString(),
        token: nfcToken,
      },
    },
  );

  expect(todayResponse.status()).toBe(401);
  expect(calendarResponse.status()).toBe(401);
  expect(eventResponse.status()).toBe(401);
  expect(nfcListResponse.status()).toBe(401);
  expect(nfcCreateResponse.status()).toBe(401);
  expect(nfcCompletionResponse.status()).toBe(401);
  await expect(todayResponse.json()).resolves.toMatchObject({
    data: null,
    error: { code: "UNAUTHENTICATED" },
  });
});

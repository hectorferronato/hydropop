import { expect, test } from "@playwright/test";

const nfcToken = "A".repeat(43);

test("keeps login centered, usable, and free of horizontal overflow on pilot viewports", async ({
  page,
}) => {
  const viewports = [
    { height: 568, width: 320 },
    { height: 844, width: 390 },
    { height: 915, width: 412 },
    { height: 390, width: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/auth/login");

    const card = page.getByTestId("login-card");
    const signIn = page.getByRole("button", { name: "Sign in" });
    await expect(card).toBeVisible();
    await expect(signIn).toBeVisible();

    const layout = await page.evaluate(() => {
      const cardElement = document.querySelector<HTMLElement>(
        '[data-testid="login-card"]',
      );
      const buttonElement = document.querySelector<HTMLElement>(
        'button[type="submit"]',
      );
      const cardRect = cardElement?.getBoundingClientRect();
      const buttonRect = buttonElement?.getBoundingClientRect();

      return {
        buttonBottom: buttonRect?.bottom ?? Number.POSITIVE_INFINITY,
        buttonTop: buttonRect?.top ?? Number.NEGATIVE_INFINITY,
        cardCenter: cardRect ? cardRect.left + cardRect.width / 2 : 0,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(
      Math.abs(layout.cardCenter - layout.clientWidth / 2),
    ).toBeLessThanOrEqual(2);
    expect(layout.buttonTop).toBeGreaterThanOrEqual(0);
    expect(layout.buttonBottom).toBeLessThanOrEqual(viewport.height);
  }
});

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

test("authenticates before resolving a friendly NFC code", async ({ page }) => {
  await page.goto("/t/bea-kitchen");

  await expect(
    page.getByRole("heading", { name: "Sign in to HydroPOP" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Ft%2Fbea-kitchen$/u);
  await expect(page.locator('input[name="next"]')).toHaveValue(
    "/t/bea-kitchen",
  );
});

test("preserves the shared pilot destination through unauthenticated scan", async ({
  page,
}) => {
  await page.goto("/t/pilot");

  await expect(
    page.getByRole("heading", { name: "Sign in to HydroPOP" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Ft%2Fpilot$/u);
  await expect(page.locator('input[name="next"]')).toHaveValue("/t/pilot");
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

test("protects every new private application destination", async ({ page }) => {
  for (const destination of [
    "/trends?range=30",
    "/community",
    "/profile",
    "/settings/community",
    "/settings/notifications",
    "/u/hector.ferronato",
  ]) {
    await page.goto(destination);

    await expect(
      page.getByRole("heading", { name: "Sign in to HydroPOP" }),
    ).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue(destination);
  }
});

test("serves the installable PWA shell and offline fallback", async ({
  request,
}) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  const workerResponse = await request.get("/sw.js");
  const offlineResponse = await request.get("/offline");

  expect(manifestResponse.status()).toBe(200);
  await expect(manifestResponse.json()).resolves.toMatchObject({
    display: "standalone",
    name: "HydroPOP",
    start_url: "/today",
  });
  expect(workerResponse.status()).toBe(200);
  expect(await workerResponse.text()).toContain('self.addEventListener("push"');
  expect(offlineResponse.status()).toBe(200);
  expect(await offlineResponse.text()).toContain("You’re offline");
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
        identifier: nfcToken,
      },
    },
  );
  const manualHydrationResponse = await request.post(
    "/api/v1/hydration-events/manual",
    {
      data: {
        action: "full",
        idempotencyKey: "playwright-manual-event-key",
        occurredAt: new Date().toISOString(),
      },
    },
  );
  const pilotActivationResponse = await request.post(
    "/api/v1/nfc-tags/pilot/activate",
  );
  const pushRegistrationResponse = await request.post(
    "/api/v1/push-subscriptions",
    { data: {} },
  );
  const notificationPreferenceResponse = await request.put(
    "/api/v1/notification-preferences",
    { data: { paceRemindersEnabled: true } },
  );
  const testPushResponse = await request.post(
    "/api/v1/push-notifications/test",
    { data: { endpoint: "https://push.example.test/current" } },
  );

  expect(todayResponse.status()).toBe(401);
  expect(calendarResponse.status()).toBe(401);
  expect(eventResponse.status()).toBe(401);
  expect(nfcListResponse.status()).toBe(401);
  expect(nfcCreateResponse.status()).toBe(401);
  expect(nfcCompletionResponse.status()).toBe(401);
  expect(manualHydrationResponse.status()).toBe(401);
  expect(pilotActivationResponse.status()).toBe(401);
  expect(pushRegistrationResponse.status()).toBe(401);
  expect(notificationPreferenceResponse.status()).toBe(401);
  expect(testPushResponse.status()).toBe(401);
  await expect(todayResponse.json()).resolves.toMatchObject({
    data: null,
    error: { code: "UNAUTHENTICATED" },
  });
});

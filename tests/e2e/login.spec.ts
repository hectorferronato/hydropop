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

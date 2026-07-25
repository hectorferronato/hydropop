import { expect, test } from "@playwright/test";

test("renders login and handles a rejected server action", async ({ page }) => {
  await page.goto("/auth/login");

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

  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Unable to sign in",
  );
  await expect(page).toHaveURL("/auth/login");
});

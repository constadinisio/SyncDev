import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the landing page. These exercise the full app shell rendering
 * without depending on a live collaboration session.
 */

test("renders the SyncDev landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/SyncDev/);
  await expect(page.getByRole("heading", { name: /SyncDev/i })).toBeVisible();
});

test("shows the create-project input by default", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByPlaceholder("Project name (e.g. my-app)")).toBeVisible();
});

test("reveals the clone-repo input after toggling 'Clone from Git'", async ({ page }) => {
  await page.goto("/");

  const cloneInput = page.getByPlaceholder("https://github.com/user/repo.git");
  await expect(cloneInput).toBeHidden();

  await page.getByRole("button", { name: /Clone from Git/i }).click();

  await expect(cloneInput).toBeVisible();
});

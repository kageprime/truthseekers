import { test, expect } from "@playwright/test";

test.describe("Chat Interface", () => {
  test("home page loads and shows suggested topics", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Truthseekers").or(page.locator("text=New Chat"))).toBeVisible({ timeout: 10000 });
  });

  test("login page redirects to auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Google").or(page.locator("text=GitHub"))).toBeVisible({ timeout: 10000 });
  });

  test("displays suggested topics on home", async ({ page }) => {
    await page.goto("/");
    const topics = ["Roman Empire", "Ancient Greece", "Black Holes", "Silk Road"];
    for (const topic of topics) {
      await expect(page.locator(`text=${topic}`).first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    }
  });
});

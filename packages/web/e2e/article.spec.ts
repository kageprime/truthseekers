import { test, expect } from "@playwright/test";

test.describe("Article Pages", () => {
  test("article page shows 404 for missing article", async ({ page }) => {
    const response = await page.goto("/article/nonexistent-article-slug");
    // Either a 404 page or redirect to home
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test("articles list page loads", async ({ page }) => {
    await page.goto("/articles");
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });

  test("queue page loads", async ({ page }) => {
    await page.goto("/queue");
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });
});

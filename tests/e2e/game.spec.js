import { test, expect } from '@playwright/test';

test.describe('Game mode default settings', () => {
  test('loads and shows mode picker', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#modePicker')).toBeVisible();
    await expect(page.locator('#btnBebas')).toBeVisible();
    await expect(page.locator('#btnTarget')).toBeVisible();
  });

  test('TepuQ Bebas advances on keypress', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btnBebas').click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
    await page.keyboard.press('a');
    await page.waitForTimeout(500);
    const count = await page.locator('.card-pop').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('TepuQ Target advances on card click', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btnTarget').click({ force: true });
    await page.waitForTimeout(500);
    const cards = page.locator('.card-pop.target-card');
    await expect(cards.first()).toBeVisible();
    await cards.first().click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('.card-pop.target-card')).toBeVisible();
  });
});

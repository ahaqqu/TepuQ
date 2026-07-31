import { test, expect } from '@playwright/test';

test.describe('Admin mode default settings', () => {
  test('loads admin page', async ({ page }) => {
    await page.goto('/?mode=admin');
    await expect(page.locator('text=TepuQ Admin')).toBeVisible();
    await expect(page.locator('#objectList .object-item')).toHaveCount(22);
  });

  test('can add object and export zip', async ({ page }) => {
    await page.goto('/?mode=admin');
    await page.locator('#btnAddObject').click({ force: true });
    await expect(page.locator('#objectForm')).not.toHaveClass(/hidden/);
    await page.locator('#inpName').fill('Test Papa');
    await page.locator('#inpTts').fill('Ini Papa');
    await page.locator('#inpColor').fill('#ff0000');
    await page.locator('#objectForm button[type="submit"]').click({ force: true });
    await expect(page.locator('text=Objek disimpan')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btnExport').click({ force: true }),
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});

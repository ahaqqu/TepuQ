import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

test.describe('Admin mode default settings', () => {
  test('loads admin page', async ({ page }) => {
    await Given('the admin page is opened', async () => {
      await page.goto('/?mode=admin');
    });

    await Then('the admin header is visible and default objects are listed', async () => {
      await expect(page.locator('text=TepuQ Admin')).toBeVisible();
      await expect(page.locator('#objectList .object-item')).toHaveCount(17);
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
    });
  });

  test('can add object and export zip', async ({ page }) => {
    await Given('the admin page is opened', async () => {
      await page.goto('/?mode=admin');
      await expect(page.locator('#objectList .object-item')).toHaveCount(17);
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
    });

    await When('the parent clicks Add Object and fills the form', async () => {
      await page.locator('#btnAddObject').click({ force: true });
      await expect(page.locator('#objectForm')).not.toHaveClass(/hidden/);
      await page.locator('#inpName').fill('Test Papa');
      await page.locator('#inpTts').fill('Ini Papa');
      await page.locator('#inpColor').fill('#ff0000');
    });

    await When('the parent saves the new object', async () => {
      await page.locator('#objectForm button[type="submit"]').click({ force: true });
      await expect(page.locator('text=Objek disimpan')).toBeVisible();
    });

    await Then('a ZIP file containing the custom object is downloaded', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#btnExport').click({ force: true }),
      ]);
      const path = await download.path();
      expect(path).toBeTruthy();
    });
  });
});

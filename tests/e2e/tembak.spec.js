import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

test.describe('TepuQ Tembak', () => {
  test('Game Picker lists TepuQ Tembak and the link opens the game', async ({ page }) => {
    await Given('the Game Picker is open', async () => {
      await page.goto('/');
      await expect(page.locator('#gamePicker')).toBeVisible();
    });

    await Then('TepuQ Tembak is listed as a game entry', async () => {
      const link = page.locator('#btnGameTembak');
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', /tembak/);
      await expect(link).toContainText('TepuQ Tembak');
    });

    await When('the player taps TepuQ Tembak', async () => {
      // mode-btn has an infinite pulse animation — force the click like the
      // other Game Picker tests do. The shooter vendors ~2MB of Three.js, so
      // wait for the document rather than window.load.
      await Promise.all([
        page.waitForURL(/\/tembak\/?/, { waitUntil: 'commit', timeout: 15000 }),
        page.locator('#btnGameTembak').click({ force: true }),
      ]);
    });

    await Then('the marble shooter loads with its start overlay', async () => {
      await expect(page.locator('#start-btn')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#scene')).toBeVisible();
      await expect(page.locator('#logo')).toContainText('TEPUQ');
    });
  });

  test('TepuQ Tembak menu button returns to the Game Picker', async ({ page }) => {
    await Given('TepuQ Tembak is open', async () => {
      await page.goto('/tembak/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#start-btn')).toBeVisible({ timeout: 15000 });
    });

    await When('the player taps the Menu button', async () => {
      await page.locator('#menu-btn').click();
    });

    await Then('the Game Picker is visible again', async () => {
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('#gamePicker')).toBeVisible();
      await expect(page.locator('#btnGameTembak')).toBeVisible();
    });
  });
});

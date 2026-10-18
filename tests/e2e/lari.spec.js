import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

// The Lari chunk includes Three.js; give it a little more time to boot.
test.describe.configure({ timeout: 60000 });

async function openGamePicker(page) {
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
  await expect(page.locator('#gamePicker')).toBeVisible();
}

test.describe('TepuQ Lari', () => {
  test('the Game Picker lists TepuQ Lari and starts the 3D runner stage', async ({ page }) => {
    await Given('the Game Picker is open', async () => {
      await openGamePicker(page);
    });

    await When('the parent picks TepuQ Lari', async () => {
      await expect(page.locator('#btnGameLari')).toBeVisible();
      await page.locator('#btnGameLari').click({ force: true });
    });

    await Then('the Lari stage is shown with its start overlay', async () => {
      await expect(page.locator('#lariStage')).toBeVisible();
      await expect(page.locator('#gamePicker')).toBeHidden();
      await expect(page.locator('#start-overlay')).toBeVisible();
      await expect(page.locator('#start-btn')).toBeVisible();
      await expect(page.locator('#game-canvas')).toBeVisible();
    });
  });

  test('MULAI starts a run and shows the HUD', async ({ page }) => {
    await Given('TepuQ Lari is started from the Game Picker', async () => {
      await openGamePicker(page);
      await page.locator('#btnGameLari').click({ force: true });
      await expect(page.locator('#start-overlay')).toBeVisible();
    });

    await When('the child presses MULAI', async () => {
      await page.locator('#start-btn').click({ force: true });
    });

    await Then('the HUD is visible and the start overlay is gone', async () => {
      await expect(page.locator('#start-overlay')).toBeHidden();
      await expect(page.locator('#hud')).toBeVisible();
      await expect(page.locator('#score-value')).toBeVisible();
    });
  });

  test('the back-to-menu button returns to the Game Picker', async ({ page }) => {
    await Given('TepuQ Lari is on the start overlay', async () => {
      await openGamePicker(page);
      await page.locator('#btnGameLari').click({ force: true });
      await expect(page.locator('#start-overlay')).toBeVisible();
    });

    await When('the player taps Pilih Game', async () => {
      await expect(page.locator('#start-overlay [data-lari-menu]')).toBeVisible();
      await page.locator('#start-overlay [data-lari-menu]').click({ force: true });
    });

    await Then('the Game Picker is visible again', async () => {
      await expect(page.locator('#gamePicker')).toBeVisible();
      await expect(page.locator('#lariStage')).toBeHidden();
      await expect(page.locator('#btnGameLari')).toBeVisible();
    });
  });
});

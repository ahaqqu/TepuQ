import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

test.describe('Post-deploy smoke tests', () => {
  test('TepuQ Bebas advances on keypress with default HTTP image', async ({ page }) => {
    await Given('the game is opened on the deployed site', async () => {
      await page.goto('/');
      await expect(page.locator('#gamePicker')).toBeVisible();
    });

    await When('the user picks TepuQ Gambar, starts Bebas, and presses a key', async () => {
      await page.locator('#btnGameGambar').click({ force: true });
      await expect(page.locator('#modePicker')).toBeVisible();
      await page.locator('#btnBebas').click({ force: true });
      await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
      await page.keyboard.press('a');
    });

    await Then('a card appears using a default HTTP starter image', async () => {
      const count = await page.locator('.card-pop').count();
      expect(count).toBeGreaterThanOrEqual(1);
      const cardImg = page.locator('.card-pop img');
      await expect(cardImg).toBeVisible();
      const src = await cardImg.getAttribute('src');
      expect(src).toMatch(/assets\/starter\/.+\.jpg/);
      expect(src).not.toMatch(/^blob:/);
    });
  });

  test('TepuQ Target advances on card click with default HTTP image', async ({ page }) => {
    await Given('the game is opened on the deployed site', async () => {
      await page.goto('/');
      await expect(page.locator('#gamePicker')).toBeVisible();
    });

    await When('the user picks TepuQ Gambar and starts TepuQ Target', async () => {
      await page.locator('#btnGameGambar').click({ force: true });
      await expect(page.locator('#modePicker')).toBeVisible();
      await page.locator('#btnTarget').click({ force: true });
      await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
    });

    await Then('the target card uses a default HTTP starter image', async () => {
      const initialCard = page.locator('.card-pop.target-card img');
      await expect(initialCard).toBeVisible();
      const initialSrc = await initialCard.getAttribute('src');
      expect(initialSrc).toMatch(/assets\/starter\/.+\.jpg/);
      expect(initialSrc).not.toMatch(/^blob:/);
    });

    await When('the user taps the target card', async () => {
      const cards = page.locator('.card-pop.target-card');
      await expect(cards.first()).toBeVisible();
      await cards.first().click({ force: true });
    });

    await Then('the next target card is visible and still uses a default HTTP starter image', async () => {
      const nextCard = page.locator('.card-pop.target-card img');
      await expect(nextCard).toBeVisible();
      const nextSrc = await nextCard.getAttribute('src');
      expect(nextSrc).toMatch(/assets\/starter\/.+\.jpg/);
      expect(nextSrc).not.toMatch(/^blob:/);
    });
  });

  test('TepuQ Kata shows slot row and letter tiles from starter words', async ({ page }) => {
    await Given('the game is opened on the deployed site', async () => {
      await page.goto('/');
      await expect(page.locator('#gamePicker')).toBeVisible();
    });

    await When('the user picks TepuQ Kata', async () => {
      await page.locator('#btnGameKata').click({ force: true });
      await expect(page.locator('#kataStage')).toBeVisible();
    });

    await Then('a word is shown as empty slots with scattered letter tiles', async () => {
      await expect(page.locator('.kata-slot-row .kata-slot').first()).toBeVisible();
      const slotCount = await page.locator('.kata-slot-row .kata-slot').count();
      expect(slotCount).toBeGreaterThanOrEqual(2);
      await expect(page.locator('.kata-scatter .kata-tile').first()).toBeVisible();
      const tileCount = await page.locator('.kata-scatter .kata-tile').count();
      expect(tileCount).toEqual(slotCount);
    });
  });
});

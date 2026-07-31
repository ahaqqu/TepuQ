import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

test.describe('Post-deploy smoke tests', () => {
  test('TepuQ Bebas advances on keypress with default HTTP image', async ({ page }) => {
    await Given('the game is opened on the deployed site', async () => {
      await page.goto('/');
      await expect(page.locator('#modePicker')).toBeVisible();
    });

    await When('the user starts TepuQ Bebas and presses a key', async () => {
      await page.locator('#btnBebas').click({ force: true });
      await page.waitForTimeout(500);
      await page.keyboard.press('a');
      await page.waitForTimeout(500);
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
      await expect(page.locator('#modePicker')).toBeVisible();
    });

    await When('the user starts TepuQ Target', async () => {
      await page.locator('#btnTarget').click({ force: true });
      await page.waitForTimeout(500);
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
      await page.waitForTimeout(500);
    });

    await Then('the next target card is visible and still uses a default HTTP starter image', async () => {
      const nextCard = page.locator('.card-pop.target-card img');
      await expect(nextCard).toBeVisible();
      const nextSrc = await nextCard.getAttribute('src');
      expect(nextSrc).toMatch(/assets\/starter\/.+\.jpg/);
      expect(nextSrc).not.toMatch(/^blob:/);
    });
  });
});

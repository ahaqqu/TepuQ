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
      expect(src).toMatch(/assets\/starter\/.+\.webp/);
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
      expect(initialSrc).toMatch(/assets\/starter\/.+\.webp/);
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
      expect(nextSrc).toMatch(/assets\/starter\/.+\.webp/);
      expect(nextSrc).not.toMatch(/^blob:/);
    });
  });

  test('TepuQ Target tap outside the card plays the encouraging sound and keeps the card', async ({ page }) => {
    let originalSrc = null;

    await Given('the browser records every audio clip playback', async () => {
      await page.addInitScript(() => {
        window.__plays = [];
        HTMLMediaElement.prototype.play = function () {
          window.__plays.push(String(this.src));
          return Promise.resolve();
        };
      });
    });

    await Given('the game is opened on the deployed site and TepuQ Target is started', async () => {
      await page.goto('/');
      await expect(page.locator('#gamePicker')).toBeVisible();
      await page.locator('#btnGameGambar').click({ force: true });
      await expect(page.locator('#modePicker')).toBeVisible();
      await page.locator('#btnTarget').click({ force: true });
      await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
      await expect(page.locator('.card-pop.target-card img')).toBeVisible();
    });

    await When('the child taps somewhere that is not the target card', async () => {
      originalSrc = await page.locator('.card-pop.target-card img').getAttribute('src');
      // Bottom-right corner: outside the centered card and outside the
      // top-left back trigger area.
      await page.mouse.click(1240, 700);
    });

    await Then('the encouraging try-again sound plays and the card does not change', async () => {
      // Picking the game on the menu also plays the select sound
      // (select-game.mp3), so count only try-again plays: exactly one.
      await expect.poll(
        () => page.evaluate(() => window.__plays.filter((p) => p.includes('try-again.mp3')).length),
        { timeout: 5000 }
      ).toBe(1);
      const plays = await page.evaluate(() => window.__plays);
      expect(plays.filter((p) => p.includes('try-again.mp3'))[0]).toContain('try-again.mp3');
      const src = await page.locator('.card-pop.target-card img').getAttribute('src');
      expect(src).toBe(originalSrc);
    });
  });

  test('TariQ Kata shows slot row and letter tiles from starter words', async ({ page }) => {
    await Given('the game is opened on the deployed site', async () => {
      await page.goto('/');
      await expect(page.locator('#gamePicker')).toBeVisible();
    });

    await When('the user picks TariQ Kata', async () => {
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

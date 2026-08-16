import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

async function startTargetMode(page) {
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
  await page.locator('#btnGameGambar').click({ force: true });
  await expect(page.locator('#modePicker')).toBeVisible();
  await page.locator('#btnTarget').click({ force: true });
  await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
  await expect(page.locator('.card-pop.target-card')).toBeVisible();
}

test.describe('TepuQ Gambar — Target mode', () => {
  test('TepuQ Target advances on card click with default HTTP image', async ({ page }) => {
    await Given('the user starts TepuQ Target mode', async () => {
      await startTargetMode(page);
    });

    await Then('the initial target card uses a default HTTP starter image', async () => {
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

  test('tapping outside the target card plays the encouraging sound', async ({ page }) => {
    let initialSrc = null;

    await Given('the browser records every audio clip playback', async () => {
      await page.addInitScript(() => {
        window.__plays = [];
        HTMLMediaElement.prototype.play = function () {
          window.__plays.push(String(this.src));
          return Promise.resolve();
        };
      });
    });

    await Given('the user starts TepuQ Target mode', async () => {
      await startTargetMode(page);
      initialSrc = await page.locator('.card-pop.target-card img').getAttribute('src');
    });

    await When('the child taps somewhere that is not the target card', async () => {
      // Bottom-right corner: outside the centered card and outside the
      // top-left back trigger area.
      await page.mouse.click(1240, 700);
    });

    await Then('the encouraging try-again sound plays exactly once', async () => {
      await expect.poll(() => page.evaluate(() => window.__plays.length), { timeout: 5000 }).toBe(1);
      const plays = await page.evaluate(() => window.__plays);
      expect(plays[0]).toContain('try-again.wav');
    });

    await Then('the target card is still the same card', async () => {
      const src = await page.locator('.card-pop.target-card img').getAttribute('src');
      expect(src).toBe(initialSrc);
    });

    await When('the child then taps the target card', async () => {
      // The interaction debounce (debounceMs=300) silently swallows a tap that
      // lands right after the mode-start interaction, and it is UI-undetectable.
      // Wait it out before tapping, then the "card advances" assertion proves it.
      await page.waitForTimeout(400);
      const card = page.locator('.card-pop.target-card');
      await card.click({ force: true });
      await expect(page.locator('.card-pop.target-card img')).toBeVisible();
    });

    await Then('the card advances to the next object', async () => {
      const src = await page.locator('.card-pop.target-card img').getAttribute('src');
      expect(src).not.toBe(initialSrc);
    });

    await Then('a successful tap does not play the sound again', async () => {
      const plays = await page.evaluate(() => window.__plays);
      expect(plays).toHaveLength(1);
    });
  });

  test('pressing Escape exits Target gameplay back to the Gambar menu', async ({ page }) => {
    await Given('the target card is playing in TepuQ Target', async () => {
      await startTargetMode(page);
    });

    await When('the child presses Escape', async () => {
      await page.keyboard.press('Escape');
    });

    await Then('the Gambar mode menu is visible again and the game is exited', async () => {
      await expect(page.locator('#modePicker')).toBeVisible();
      await expect(page.locator('#card')).toHaveClass(/hidden/);
    });

    await When('the parent taps "Pilih Game" to go further back', async () => {
      await page.locator('#btnBackToGames').click({ force: true });
    });

    await Then('the top-level Game Picker is visible', async () => {
      await expect(page.locator('#gamePicker')).toBeVisible();
      await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
    });
  });

  test('long-pressing the top-left corner exits Target gameplay back to the Gambar menu', async ({ page }) => {
    await Given('the target card is playing in TepuQ Target', async () => {
      await startTargetMode(page);
    });

    await When('the child long-presses the top-left corner for 1.5s', async () => {
      const trigger = page.locator('#backTrigger');
      const box = await trigger.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      // The hold itself lasts 1.5s (PRESS_MS); the mode menu becomes visible
      // only after the timer fires, so wait on the DOM change that proves it.
      await expect(page.locator('#modePicker')).toBeVisible({ timeout: 4000 });
      await page.mouse.up();
    });

    await Then('the Gambar mode menu is visible again', async () => {
      await expect(page.locator('#modePicker')).toBeVisible();
      await expect(page.locator('#card')).toHaveClass(/hidden/);
    });
  });
});
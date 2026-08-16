import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const Given = test.step;
const When = test.step;
const Then = test.step;

async function resetAllData(page) {
  await page.goto('/?mode=admin');
  await expect(page.locator('text=TepuQ Admin')).toBeVisible();
  await page.locator('#editorTabs .tab[data-editortab="settings"]').click({ force: true });
  await expect(page.locator('#btnResetAll')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#btnResetAll').click({ force: true });
  await page.waitForURL('/?mode=admin');
  await expect(page.locator('#objectList .object-item')).toHaveCount(17);
  // Wait for bootstrap to finish so the admin UI is actually interactive.
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
}

async function startBebasMode(page) {
  await page.goto('/');
  await page.evaluate(() => { sessionStorage.clear(); });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
  // The Game Picker is the top-level menu; pick TepuQ Gambar first.
  await expect(page.locator('#gamePicker')).toBeVisible();
  await page.locator('#btnGameGambar').click({ force: true });
  await expect(page.locator('#modePicker')).toBeVisible();
  await page.locator('#btnBebas').click({ force: true });
  await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
}

test.describe('Game mode default settings', () => {
  test('loads and shows the game picker, then the Gambar mode picker', async ({ page }) => {
    await Given('the game is opened', async () => {
      await page.goto('/');
    });

    await Then('the game picker with both games is visible', async () => {
      await expect(page.locator('#gamePicker')).toBeVisible();
      await expect(page.locator('#btnGameGambar')).toBeVisible();
      await expect(page.locator('#btnGameKata')).toBeVisible();
    });

    await When('the user picks TepuQ Gambar', async () => {
      await page.locator('#btnGameGambar').click({ force: true });
    });

    await Then('the Gambar mode picker with Bebas and Target is visible', async () => {
      await expect(page.locator('#modePicker')).toBeVisible();
      await expect(page.locator('#btnBebas')).toBeVisible();
      await expect(page.locator('#btnTarget')).toBeVisible();
    });
  });

  test('TepuQ Bebas advances on keypress with default HTTP image', async ({ page }) => {
    await Given('the user starts TepuQ Bebas mode', async () => {
      await startBebasMode(page);
    });

    await When('the user presses any key', async () => {
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
    await Given('the user starts TepuQ Target mode', async () => {
      await page.goto('/');
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
      await page.locator('#btnGameGambar').click({ force: true });
      await expect(page.locator('#modePicker')).toBeVisible();
      await page.locator('#btnTarget').click({ force: true });
      await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
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
      await page.goto('/');
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
      await page.locator('#btnGameGambar').click({ force: true });
      await expect(page.locator('#modePicker')).toBeVisible();
      await page.locator('#btnTarget').click({ force: true });
      await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
      await expect(page.locator('.card-pop.target-card')).toBeVisible();
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

    await When('the child then taps the target card', async () => {
      const card = page.locator('.card-pop.target-card');
      await card.click({ force: true });
      await expect(page.locator('.card-pop.target-card img')).toBeVisible();
    });

    await Then('a successful tap does not play the sound again', async () => {
      const plays = await page.evaluate(() => window.__plays);
      expect(plays).toHaveLength(1);
    });
  });

  test('default Papa image uses HTTP URL, then custom image via key p', async ({ page }) => {
    await Given('the database is reset to default starter objects', async () => {
      await resetAllData(page);
    });

    await When('the parent opens the default Papa object in admin', async () => {
      await page.goto('/?mode=admin');
      await expect(page.locator('#objectList .object-item')).toHaveCount(17);
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
      const papaItem = page.locator('#objectList .object-item', { hasText: /Papa/ });
      await papaItem.locator('[data-action="edit"]').click({ force: true });
      await expect(page.locator('#editorTitle')).toHaveText('Edit Objek');
    });

    await Then('the preview shows the default HTTP starter image', async () => {
      const previewImg = page.locator('#photoPreview img');
      await expect(previewImg).toBeVisible();
      const defaultSrc = await previewImg.getAttribute('src');
      expect(defaultSrc).toMatch(/assets\/starter\/papa\.jpg/);
    });

    await When('the parent binds key p to Papa and saves', async () => {
      await page.locator('#inpKeys').fill('p');
      await page.locator('#objectForm button[type="submit"]').click({ force: true });
      await expect(page.locator('text=Objek disimpan')).toBeVisible();
    });

    await Then('pressing p in gameplay shows the default HTTP Papa image', async () => {
      await startBebasMode(page);
      await page.keyboard.press('p');
      const cardImg = page.locator('.card-pop img');
      await expect(cardImg).toBeVisible();
      const gameDefaultSrc = await cardImg.getAttribute('src');
      expect(gameDefaultSrc).toMatch(/assets\/starter\/papa\.jpg/);
    });

    await When('the parent uploads a custom image for Papa', async () => {
      await page.goto('/?mode=admin');
      await expect(page.locator('#objectList .object-item')).toHaveCount(17);
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
      const papaItem = page.locator('#objectList .object-item', { hasText: /Papa/ });
      await papaItem.locator('[data-action="edit"]').click({ force: true });
      await expect(page.locator('#editorTitle')).toHaveText('Edit Objek');
      await page.locator('#inpPhoto').setInputFiles(path.join(__dirname, 'fixtures', 'papa.png'));
      await expect(page.locator('#photoPreview img[src^="blob:"]')).toBeVisible();
      await page.locator('#objectForm button[type="submit"]').click({ force: true });
      await expect(page.locator('text=Objek disimpan')).toBeVisible();
    });

    await Then('pressing p in gameplay now shows the custom blob image', async () => {
      await startBebasMode(page);
      await page.keyboard.press('p');
      const cardImg = page.locator('.card-pop img');
      await expect(cardImg).toBeVisible();
      const src = await cardImg.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toMatch(/assets\/starter\/papa\.jpg/);
      expect(src).toMatch(/^blob:/);
    });
  });

  test('admin add/edit/delete custom cards reflected in gameplay', async ({ page }) => {
    await Given('the database is reset to default starter objects', async () => {
      await resetAllData(page);
    });

    await When('the parent adds Custom Apple with key 1 and a custom image', async () => {
      await page.locator('#btnAddObject').click({ force: true });
      await expect(page.locator('#objectForm')).not.toHaveClass(/hidden/);
      await page.locator('#inpName').fill('Custom Apple');
      await page.locator('#inpTts').fill('Ini Apel');
      await page.locator('#inpKeys').fill('1');
      await page.locator('#inpPhoto').setInputFiles(path.join(__dirname, 'fixtures', 'papa.png'));
      await expect(page.locator('#photoPreview img[src^="blob:"]')).toBeVisible();
      await page.locator('#objectForm button[type="submit"]').click({ force: true });
      await expect(page.locator('text=Objek disimpan')).toBeVisible();
      await expect(page.locator('#objectList .object-item', { hasText: /Custom Apple/ }).locator('.obj-thumb[src^="blob:"]')).toBeVisible();
    });

    await When('the parent adds Custom Banana with key 2 and a custom image', async () => {
      await page.locator('#btnAddObject').click({ force: true });
      await expect(page.locator('#objectForm')).not.toHaveClass(/hidden/);
      await page.locator('#inpName').fill('Custom Banana');
      await page.locator('#inpTts').fill('Ini Pisang');
      await page.locator('#inpKeys').fill('2');
      await page.locator('#inpPhoto').setInputFiles(path.join(__dirname, 'fixtures', 'papa.png'));
      await expect(page.locator('#photoPreview img[src^="blob:"]')).toBeVisible();
      await page.locator('#objectForm button[type="submit"]').click({ force: true });
      await expect(page.locator('text=Objek disimpan')).toBeVisible();
      await expect(page.locator('#objectList .object-item', { hasText: /Custom Banana/ }).locator('.obj-thumb[src^="blob:"]')).toBeVisible();
    });

    await Then('both custom cards appear in gameplay via their bound keys', async () => {
      await startBebasMode(page);

      await page.keyboard.press('1');
      const appleCard = page.locator('.card-pop img');
      await expect(appleCard).toBeVisible();
      const appleSrc = await appleCard.getAttribute('src');
      expect(appleSrc).toMatch(/^blob:/);

      // Wait for the entry animation to finish so the debounce window has elapsed.
      await page.waitForFunction(() => {
        const card = document.querySelector('.card-pop');
        if (!card) return false;
        return (card.getAnimations() || []).length === 0;
      }, { timeout: 5000 });

      await page.keyboard.press('2');
      const bananaCard = page.locator('.card-pop img').last();
      await expect(bananaCard).toBeVisible();
      const bananaSrc = await bananaCard.getAttribute('src');
      expect(bananaSrc).toMatch(/^blob:/);
    });

    await When('the parent deletes Custom Apple and edits Custom Banana', async () => {
      await page.goto('/?mode=admin');
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
      const appleItem = page.locator('#objectList .object-item', { hasText: /Custom Apple/ });
      const bananaItem = page.locator('#objectList .object-item', { hasText: /Custom Banana/ });

      page.once('dialog', (dialog) => dialog.accept());
      await appleItem.locator('[data-action="delete"]').click({ force: true });
      await expect(page.locator('#objectList .object-item', { hasText: /Custom Apple/ })).toHaveCount(0);

      await bananaItem.locator('[data-action="edit"]').click({ force: true });
      await page.locator('#inpName').fill('Custom Banana Edited');
      await page.locator('#inpTts').fill('Ini Pisang Edit');
      await page.locator('#inpKeys').fill('9');
      await page.locator('#objectForm button[type="submit"]').click({ force: true });
      await expect(page.locator('text=Objek disimpan')).toBeVisible();
    });

    await Then('Custom Apple is gone and Custom Banana uses the new key and name', async () => {
      await startBebasMode(page);

      await page.keyboard.press('1');
      const randomCard = page.locator('.card-pop').first();
      await expect(randomCard).toBeVisible();
      const randomText = await randomCard.textContent();
      expect(randomText).not.toContain('Custom Apple');

      // Wait for the entry animation to finish so the debounce window has elapsed.
      await page.waitForFunction(() => {
        const card = document.querySelector('.card-pop');
        if (!card) return false;
        return (card.getAnimations() || []).length === 0;
      }, { timeout: 5000 });

      await page.keyboard.press('9');
      const editedCard = page.locator('.card-pop').last();
      await expect(editedCard).toBeVisible();
      const editedImg = editedCard.locator('img');
      const editedSrc = await editedImg.getAttribute('src');
      expect(editedSrc).toMatch(/^blob:/);
      const editedAlt = await editedImg.getAttribute('alt');
      expect(editedAlt).toContain('Custom Banana Edited');
    });
  });
});

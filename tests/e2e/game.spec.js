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
}

async function startBebasMode(page) {
  await page.goto('/');
  await page.evaluate(() => { sessionStorage.clear(); });
  await page.goto('/');
  await page.locator('#btnBebas').click({ force: true });
  await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
}

test.describe('Game mode default settings', () => {
  test('loads and shows mode picker', async ({ page }) => {
    await Given('the game is opened', async () => {
      await page.goto('/');
    });

    await Then('the mode picker with both buttons is visible', async () => {
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

  test('default Papa image uses HTTP URL, then custom image via key p', async ({ page }) => {
    await Given('the database is reset to default starter objects', async () => {
      await resetAllData(page);
    });

    await When('the parent opens the default Papa object in admin', async () => {
      await page.goto('/?mode=admin');
      await expect(page.locator('#objectList .object-item')).toHaveCount(17);
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
      const papaItem = page.locator('#objectList .object-item', { hasText: /Papa/ });
      await papaItem.locator('[data-action="edit"]').click({ force: true });
      await expect(page.locator('#editorTitle')).toHaveText('Edit Objek');
      await page.locator('#inpPhoto').setInputFiles(path.join(__dirname, 'fixtures', 'papa.png'));
      // The file input handler resizes the image asynchronously. Wait for the
      // blob preview to appear before saving, otherwise pendingImageBlob may
      // still be null and the object is saved without a custom image.
      await page.waitForTimeout(300);
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
      // Wait for the async image resize before saving so the blob is available.
      await page.waitForTimeout(300);
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
      // Wait for the async image resize before saving so the blob is available.
      await page.waitForTimeout(300);
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

      await page.evaluate(() => { document.querySelectorAll('.card-pop').forEach((c) => c.remove()); });
      // Allow the first card's animation/debounce to settle before pressing the next key.
      await page.waitForTimeout(300);
      await page.keyboard.press('2');
      const bananaCard = page.locator('.card-pop img');
      await expect(bananaCard).toBeVisible();
      const bananaSrc = await bananaCard.getAttribute('src');
      expect(bananaSrc).toMatch(/^blob:/);
    });

    await When('the parent deletes Custom Apple and edits Custom Banana', async () => {
      await page.goto('/?mode=admin');
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
      const randomCard = page.locator('.card-pop');
      await expect(randomCard.first()).toBeVisible();
      if (await randomCard.first().isVisible()) {
        const randomText = await randomCard.first().textContent();
        expect(randomText).not.toContain('Custom Apple');
      }

      await page.evaluate(() => { document.querySelectorAll('.card-pop').forEach((c) => c.remove()); });
      // Allow the previous card's animation/debounce to settle before the next key.
      await page.waitForTimeout(300);
      await page.keyboard.press('9');
      const editedCard = page.locator('.card-pop');
      await expect(editedCard).toBeVisible();
      const editedImg = editedCard.locator('img');
      const editedSrc = await editedImg.getAttribute('src');
      expect(editedSrc).toMatch(/^blob:/);
      const editedAlt = await editedImg.getAttribute('alt');
      expect(editedAlt).toContain('Custom Banana Edited');
    });
  });
});

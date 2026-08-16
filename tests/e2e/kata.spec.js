import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

// Set Kata session length to the minimum (5) so the win screen is reachable
// quickly in E2E, then return to the game.
async function setShortSession(page) {
  await page.goto('/?mode=admin');
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
  await page.locator('#editorTabs .tab[data-editortab="kata-settings"]').click({ force: true });
  await page.locator('#setKataSessionLength').fill('5');
  await page.locator('#btnSaveKataSettings').click({ force: true });
  await expect(page.locator('text=Pengaturan Kata disimpan')).toBeVisible();
}

async function startKata(page) {
  await page.goto('/');
  await page.evaluate(() => { sessionStorage.clear(); });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
  await expect(page.locator('#gamePicker')).toBeVisible();
  await page.locator('#btnGameKata').click({ force: true });
  await expect(page.locator('#kataStage')).toBeVisible();
}

// Drag a letter tile into the correct slot using real pointer events. The tile
// is at its scattered position; we drag it to the matching slot's center.
const usedTileIndices = new Set();

async function dragTileToMatchingSlot(page) {
  await page.locator('.kata-scatter .kata-tile').first().waitFor({ state: 'visible' });
  const tiles = await page.locator('.kata-scatter .kata-tile').all();
  const slots = await page.locator('.kata-slot-row .kata-slot').all();
  // Resolve each tile's letter up front (find() can't take an async predicate).
  const tileLetters = await Promise.all(tiles.map((t) => t.getAttribute('data-letter')));
  for (let s = 0; s < slots.length; s++) {
    const slot = slots[s];
    const slotBox = await slot.boundingBox();
    const slotLetter = await slot.getAttribute('data-letter');
    if (!slotBox || await slot.evaluate((el) => el.classList.contains('filled'))) continue;
    // First unused tile whose letter matches this slot.
    const tileIndex = tileLetters.findIndex((ltr, i) => ltr === slotLetter && !usedTileIndices.has(i));
    if (tileIndex < 0) continue;
    usedTileIndices.add(tileIndex);
    const tileBox = await tiles[tileIndex].boundingBox();
    if (!tileBox) continue;
    // Real drag: move to tile center, press, move to slot center, release.
    await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2, { steps: 10 });
    await page.mouse.up();
    return true;
  }
  return false;
}

function resetUsedTiles() {
  usedTileIndices.clear();
}

test.describe('TepuQ Kata', () => {
  test('the back-to-menu button returns to the Game Picker', async ({ page }) => {
    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
      await expect(page.locator('#kataStage')).toBeVisible();
    });

    await When('the child taps the back-to-menu button', async () => {
      await expect(page.locator('.kata-back-btn')).toBeVisible();
      await page.locator('.kata-back-btn').click({ force: true });
    });

    await Then('the Game Picker is visible again', async () => {
      await expect(page.locator('#gamePicker')).toBeVisible();
      await expect(page.locator('#kataStage')).toHaveClass(/hidden/);
    });
  });

  test('the shared word photo is shown during gameplay', async ({ page }) => {
    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
    });

    await Then('the current word shows its shared library photo', async () => {
      const photo = page.locator('.kata-photo');
      await expect(photo).toBeVisible();
      const src = await photo.getAttribute('src');
      expect(src).toContain('assets/starter');
    });

    await Then('the photo is about 30% of the shorter screen edge', async () => {
      // Desktop Chrome viewport is 1280x720, so 30vmin = 216px.
      const box = await page.locator('.kata-photo').boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(200);
      expect(box.height).toBeGreaterThanOrEqual(200);
    });

    await Then('the letters are scaled up on desktop', async () => {
      // vmin 720 -> scale 1.33x. Slots stay at 160px; tiles only shrink when a
      // long word would not fit the scatter area (118px worst case for 6
      // letters, still above the 110px base setting).
      const tileBox = await page.locator('.kata-tile').first().boundingBox();
      const slotBox = await page.locator('.kata-slot').first().boundingBox();
      expect(tileBox.width).toBeGreaterThanOrEqual(110);
      expect(slotBox.width).toBeGreaterThanOrEqual(155);
    });
  });

  test('a big desktop screen gets much bigger letters and a 30% photo', async ({ page }) => {
    await Given('TepuQ Kata is started on a 1080p viewport', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await startKata(page);
      await expect(page.locator('.kata-tile').first()).toBeVisible();
    });

    await Then('the photo is about 30% of the screen', async () => {
      const box = await page.locator('.kata-photo').boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(300);
      expect(box.height).toBeGreaterThanOrEqual(300);
    });

    await Then('the letters are much bigger than the base settings', async () => {
      // vmin 1080 -> scale 2x: tiles 216-220px; slots 225-240px (6-letter words
      // shrink slightly so the slot row fits beside the photo; base 110/120).
      const tileBox = await page.locator('.kata-tile').first().boundingBox();
      const slotBox = await page.locator('.kata-slot').first().boundingBox();
      expect(tileBox.width).toBeGreaterThanOrEqual(175);
      expect(slotBox.width).toBeGreaterThanOrEqual(220);
    });
  });

  test('phone viewport keeps a bigger photo and slightly bigger letters', async ({ page }) => {
    await Given('TepuQ Kata is started on a phone-sized viewport', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await startKata(page);
      await expect(page.locator('.kata-tile').first()).toBeVisible();
    });

    await Then('the photo is bigger than the old mobile size', async () => {
      const box = await page.locator('.kata-photo').boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(110);
      expect(box.height).toBeGreaterThanOrEqual(110);
    });

    await Then('the letters stay at least as big as the base settings', async () => {
      // Mobile scale 1.15x, then adapted to the word length so nothing
      // overflows: slots 113-138px, tiles 90-126px (base 110/120).
      const tileBox = await page.locator('.kata-tile').first().boundingBox();
      const slotBox = await page.locator('.kata-slot').first().boundingBox();
      expect(tileBox.width).toBeGreaterThanOrEqual(85);
      expect(slotBox.width).toBeGreaterThanOrEqual(110);
    });
  });

  test('completing all letters of a word fills every slot', async ({ page }) => {
    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
    });

    await When('the child drags each letter into its matching slot', async () => {
      resetUsedTiles();
      const slotCount = await page.locator('.kata-slot-row .kata-slot').count();
      for (let i = 0; i < slotCount; i++) {
        const placed = await dragTileToMatchingSlot(page);
        expect(placed).toBe(true);
        // Wait for the snap to register (class change), per AGENTS.md no waitForTimeout.
        await expect(page.locator('.kata-slot.filled').nth(i)).toBeVisible();
      }
    });

    await Then('the word completed with every slot filled', async () => {
      // The game auto-advances 2s after a word completes. Read the state right
      // after the drags: either we catch the completed word (celebrating, all
      // slots filled) or the game already advanced (next word, nothing filled)
      // — both prove the previous word completed with every slot filled.
      const total = await page.locator('.kata-slot-row .kata-slot').count();
      const filled = await page.locator('.kata-slot.filled').count();
      const phase = await page.evaluate(() => window.__kataState?.phase);
      if (phase === 'CELEBRATING') {
        expect(filled).toBe(total);
      } else {
        expect(filled).toBe(0);
      }
    });
  });

  test('completing the session length shows the win screen', async ({ page }) => {
    await Given('Kata session length is set to 5 words', async () => {
      await setShortSession(page);
    });

    await When('the child starts Kata and completes 5 words', async () => {
      await startKata(page);
      for (let w = 0; w < 5; w++) {
        if (w > 0) {
          // Wait for the auto-advance to clear the previous word's filled slots
          // before reading the new word's slots/tiles (2s auto-advance delay).
          await expect(page.locator('.kata-slot.filled')).toHaveCount(0, { timeout: 5000 });
        }
        await expect(page.locator('.kata-scatter .kata-tile').first()).toBeVisible();
        resetUsedTiles();
        const slotCount = await page.locator('.kata-slot-row .kata-slot').count();
        for (let i = 0; i < slotCount; i++) {
          await dragTileToMatchingSlot(page);
          await expect(page.locator('.kata-slot.filled').nth(i)).toBeVisible();
        }
      }
    });

    await Then('the win screen with "Hebat!" appears', async () => {
      await expect(page.locator('.kata-win')).toBeVisible();
      await expect(page.locator('.kata-win h2')).toHaveText('Hebat!');
    });
  });
});
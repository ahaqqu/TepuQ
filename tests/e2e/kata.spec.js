import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

// Set Kata session length to the minimum (5) so the win screen is reachable
// quickly in E2E, then return to the game.
async function setShortSession(page) {
  await page.goto('/?mode=admin');
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
  await page.locator('#adminGameTabs .game-tab[data-game="kata"]').click({ force: true });
  await page.locator('#kataEditorTabs .tab[data-kataeditortab="settings"]').click({ force: true });
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

    await Then('all slots are filled', async () => {
      // Read the count once, immediately after the drags, so the assertion does
      // not race the game's 2s auto-advance (which clears the completed word).
      const total = await page.locator('.kata-slot-row .kata-slot').count();
      const filled = await page.locator('.kata-slot.filled').count();
      expect(filled).toBe(total);
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
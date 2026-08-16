import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

// A full Kata session (3 words x drags + auto-advance + celebration) takes
// ~14s on an idle machine; under full-suite parallel load it has crossed the
// default 30s budget. Give these session-length tests a bigger timeout.
test.describe.configure({ timeout: 90000 });

// Set Kata session length to the minimum (5) so the win screen is reachable
// quickly in E2E, then return to the game.
async function setShortSession(page) {
  await page.goto('/?mode=admin');
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
  await page.locator('#editorTabs .tab[data-editortab="kata-settings"]').click({ force: true });
  await page.locator('#setKataSessionLength').fill('3');
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
      // Desktop Chrome viewport is 1280x720. The image is scaled proportionally
      // so height is the controlling dimension; width follows aspect ratio.
      const box = await page.locator('.kata-photo').boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(200);
    });

    await Then('the letters are scaled up on desktop', async () => {
      // vmin 720 -> scale 1.33x. Tiles and slots now share one fitted size,
      // so both are the same width.
      const tileBox = await page.locator('.kata-tile').first().boundingBox();
      const slotBox = await page.locator('.kata-slot').first().boundingBox();
      expect(tileBox.width).toBeGreaterThanOrEqual(110);
      expect(slotBox.width).toBe(tileBox.width);
    });
  });

  test('tapping the word photo says the word out loud', async ({ page }) => {
    await Given('the browser records every spoken utterance', async () => {
      await page.addInitScript(() => {
        window.__spoken = [];
        // speechSynthesis is a read-only accessor on window, so it must be
        // replaced with defineProperty for the stub to actually take effect.
        const fakeSynth = {
          speaking: false,
          pending: false,
          paused: false,
          getVoices: () => [],
          cancel: () => {},
          resume: () => {},
          speak: (u) => { window.__spoken.push(u.text); },
        };
        Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: function (text) { this.text = text; },
          configurable: true,
        });
      });
    });

    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
      await expect(page.locator('.kata-photo')).toBeVisible();
    });

    await When('the child taps the word photo', async () => {
      await page.locator('.kata-photo').click({ force: true });
    });

    await Then('the TTS says the current word name', async () => {
      const word = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.kata-slot'))
          .map((slot) => slot.dataset.letter)
          .join('')
      );
      expect(word.length).toBeGreaterThan(0);
      await expect.poll(
        () => page.evaluate((w) => window.__spoken.some((t) => t === w), word),
        { timeout: 5000 }
      ).toBe(true);
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
      // The image is scaled proportionally, so height is the controlling
      // dimension; width follows the intrinsic aspect ratio.
      expect(box.height).toBeGreaterThanOrEqual(300);
    });

    await Then('the letters are much bigger than the base settings', async () => {
      // vmin 1080 -> scale up to 2x, then fitted to the word length.
      // Tiles and slots share one fitted size, so both are the same width.
      const tileBox = await page.locator('.kata-tile').first().boundingBox();
      const slotBox = await page.locator('.kata-slot').first().boundingBox();
      expect(tileBox.width).toBeGreaterThanOrEqual(160);
      expect(slotBox.width).toBe(tileBox.width);
    });
  });

  test('phone viewport keeps a bigger photo and slightly bigger letters', async ({ page }) => {
    await Given('TepuQ Kata is started on a phone-sized viewport', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await startKata(page);
      await expect(page.locator('.kata-tile').first()).toBeVisible();
    });

    await Then('the photo is bigger than the old mobile size', async () => {
      // The image is scaled proportionally; height is the controlling dimension.
      const box = await page.locator('.kata-photo').boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(110);
    });

    await Then('the letters stay at least as big as the base settings', async () => {
      // Mobile scale 1.15x, then adapted to the word length so nothing
      // overflows. Tiles and slots share the same fitted size.
      const tileBox = await page.locator('.kata-tile').first().boundingBox();
      const slotBox = await page.locator('.kata-slot').first().boundingBox();
      expect(tileBox.width).toBeGreaterThanOrEqual(75);
      expect(slotBox.width).toBe(tileBox.width);
    });
  });

  test('typing a letter on the keyboard moves one matching tile into its slot', async ({ page }) => {
    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
    });

    await When('the child types the first letter of the current word', async () => {
      // Read the first unfilled slot's letter, which always matches the current word.
      const firstSlot = page.locator('.kata-slot').first();
      await expect(firstSlot).toBeVisible();
      const letter = await firstSlot.getAttribute('data-letter');
      expect(letter).not.toBe('');
      await page.keyboard.press(letter);
    });

    await Then('exactly one tile is placed and the first slot is filled', async () => {
      await expect(page.locator('.kata-slot.filled')).toHaveCount(1);
      await expect(page.locator('.kata-tile.placed')).toHaveCount(1);
    });
  });

  test('a letter dragged into its slot is read out loud', async ({ page }) => {
    await Given('the browser records every spoken utterance', async () => {
      await page.addInitScript(() => {
        window.__spoken = [];
        const fakeSynth = {
          speaking: false,
          pending: false,
          paused: false,
          getVoices: () => [],
          cancel: () => {},
          resume: () => {},
          speak: (u) => { window.__spoken.push(u.text); },
        };
        Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: function (text) { this.text = text; },
          configurable: true,
        });
      });
    });

    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
      await expect(page.locator('.kata-scatter .kata-tile').first()).toBeVisible();
    });

    await When('the child drags one letter into its matching slot', async () => {
      const slot = page.locator('.kata-slot').first();
      const letter = await slot.getAttribute('data-letter');
      const tile = page.locator(`.kata-scatter .kata-tile[data-letter="${letter}"]`).first();
      const slotBox = await slot.boundingBox();
      const tileBox = await tile.boundingBox();
      await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2, { steps: 10 });
      await page.mouse.up();
      await expect(page.locator('.kata-slot.filled')).toHaveCount(1);
    });

    await Then('the TTS says that letter out loud', async () => {
      const letter = await page.locator('.kata-slot').first().getAttribute('data-letter');
      await expect.poll(
        () => page.evaluate((l) => window.__spoken.some((t) => t === l), letter),
        { timeout: 5000 }
      ).toBe(true);
    });
  });

  test('completing a word speaks the last letter first, then the whole word', async ({ page }) => {
    await Given('the browser records every spoken utterance', async () => {
      await page.addInitScript(() => {
        window.__spoken = [];
        window.__speechStub = true;
        const fakeSynth = {
          speaking: false,
          pending: false,
          paused: false,
          getVoices: () => [],
          cancel: () => {},
          resume: () => {},
          speak: (u) => { window.__spoken.push(u.text); },
        };
        Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: function (text) { this.text = text; },
          configurable: true,
        });
      });
    });

    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
    });

    await When('the child drags every letter into its matching slot', async () => {
      resetUsedTiles();
      const slotCount = await page.locator('.kata-slot-row .kata-slot').count();
      for (let i = 0; i < slotCount; i++) {
        const placed = await dragTileToMatchingSlot(page);
        expect(placed).toBe(true);
        await expect(page.locator('.kata-slot.filled').nth(i)).toBeVisible();
      }
    });

    await Then('the last letter is spoken before the completed word', async () => {
      const slots = await page.locator('.kata-slot-row .kata-slot').all();
      const letters = await Promise.all(slots.map((s) => s.getAttribute('data-letter')));
      const word = letters.join('');
      const lastLetter = letters[letters.length - 1];
      try {
        // 10s window: the completed word is spoken ~700ms after the last
        // letter and the game auto-advances ~2s later, so the tail of the
        // recorded speech must still show [lastLetter, word].
        await expect.poll(
          () => page.evaluate(() => {
            const spoken = window.__spoken;
            return spoken.length >= 2 ? spoken.slice(-2) : null;
          }),
          { timeout: 10000 }
        ).toEqual([lastLetter, word]);
      } catch (err) {
        // Rare flake: the poll reported fewer than 2 recorded utterances.
        // Dump the recorded speech plus the game state so the next failure
        // shows whether the stub was installed and the word completed.
        const diag = await page.evaluate(() => ({
          spoken: window.__spoken ?? null,
          speechStubInstalled: window.__speechStub === true,
          phase: window.__kataState?.phase ?? null,
          wordIndex: window.__kataState?.index ?? null,
          completed: window.__kataState?.completed ?? null,
          currentWord: window.__kataState?.words?.[window.__kataState.index]?.word ?? null,
        }));
        err.message += `\nDiagnostics: ${JSON.stringify(diag)}`;
        throw err;
      }
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

  test('completing the session length celebrates and continues without a blocking screen', async ({ page }) => {
    await Given('Kata session length is set to 3 words', async () => {
      await setShortSession(page);
    });

    await When('the child starts Kata and completes 3 words', async () => {
      await startKata(page);
      for (let w = 0; w < 3; w++) {
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

    await Then('no win-screen popup appears and a new session starts automatically', async () => {
      // The victory celebration (confetti + TTS + fanfare) must never block the
      // game: the win-screen overlay is gone and the next session starts on
      // its own. The old session's filled slots clear only on the restart.
      await expect(page.locator('.kata-win')).toHaveCount(0);
      await expect(page.locator('.kata-slot.filled')).toHaveCount(0, { timeout: 8000 });
      await expect(page.locator('.kata-scatter .kata-tile').first()).toBeVisible();
      const newWordId = await page.evaluate(() => window.__kataState?.words[0]?.id);
      expect(newWordId).toBeTruthy();
    });
  });

  test('the next session starts automatically with words not shown yet', async ({ page }) => {
    let firstSessionIds = [];

    await Given('Kata session length is set to 3 words', async () => {
      await setShortSession(page);
    });

    await When('the child completes the 3-word session', async () => {
      await startKata(page);
      await page.waitForFunction(() => window.__kataState && window.__kataState.words.length > 0);
      firstSessionIds = await page.evaluate(() => window.__kataState.words.map((w) => w.id));
      expect(firstSessionIds).toHaveLength(3);
      for (let w = 0; w < 3; w++) {
        if (w > 0) {
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

    await Then('a new session with none of the finished session\'s words begins on its own', async () => {
      // No "Main Lagi" button anymore: the rotation restarts automatically
      // with the FULL word list after the victory celebration.
      await expect(page.locator('.kata-slot.filled')).toHaveCount(0, { timeout: 8000 });
      await expect(page.locator('.kata-scatter .kata-tile').first()).toBeVisible();
      const secondSessionIds = await page.evaluate(() => window.__kataState.words.map((w) => w.id));
      expect(secondSessionIds).toHaveLength(3);
      expect(secondSessionIds.filter((id) => firstSessionIds.includes(id))).toHaveLength(0);
    });
  });

  test('an unfinished tile resting over the targets stays free to move', async ({ page }) => {
    let droppedIndex = -1;

    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
    });

    await When('the child drops a letter onto a target with a different letter', async () => {
      await page.locator('.kata-tile').first().waitFor({ state: 'visible' });
      const slots = await page.locator('.kata-slot-row .kata-slot').all();
      expect(slots.length).toBeGreaterThan(1);
      const slotLetters = await Promise.all(slots.map((s) => s.getAttribute('data-letter')));
      const tiles = await page.locator('.kata-scatter .kata-tile').all();
      const tileLetters = await Promise.all(tiles.map((t) => t.getAttribute('data-letter')));

      // A tile whose letter does not match the first target, dropped dead on it.
      // Its own targets are at least one full slot spacing away, so it free
      // drops and rests exactly on top of the target row.
      droppedIndex = tileLetters.findIndex((ltr) => ltr !== slotLetters[0]);
      expect(droppedIndex).toBeGreaterThanOrEqual(0);
      const tileBox = await tiles[droppedIndex].boundingBox();
      const slot0Box = await slots[0].boundingBox();
      await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(slot0Box.x + slot0Box.width / 2, slot0Box.y + slot0Box.height / 2, { steps: 10 });
      await page.mouse.up();
      await expect(tiles[droppedIndex]).not.toHaveClass(/placed/);
      // The dropped tile is now resting in the target row (bottom half of the screen).
      const resting = await tiles[droppedIndex].boundingBox();
      expect(resting.y).toBeGreaterThan(300);
    });

    await Then('the child can grab it again right over the targets and move it away', async () => {
      const dropped = page.locator('.kata-scatter .kata-tile').nth(droppedIndex);
      const resting = await dropped.boundingBox();
      await page.mouse.move(resting.x + resting.width / 2, resting.y + resting.height / 2);
      await page.mouse.down();
      await page.mouse.move(resting.x + resting.width / 2, resting.y - 90, { steps: 8 });
      await page.mouse.up();
      const moved = await dropped.boundingBox();
      expect(Math.abs(moved.y - resting.y)).toBeGreaterThan(20);
      await expect(dropped).not.toHaveClass(/placed/);
    });
  });

  test('dropping a letter off-target plays an encouraging sound', async ({ page }) => {
    await Given('the browser records every audio clip playback', async () => {
      await page.addInitScript(() => {
        window.__plays = [];
        HTMLMediaElement.prototype.play = function () {
          window.__plays.push(String(this.src));
          return Promise.resolve();
        };
      });
    });

    await Given('TepuQ Kata is started', async () => {
      await startKata(page);
    });

    await When('the child drops a letter far away from any target', async () => {
      await page.locator('.kata-tile').first().waitFor({ state: 'visible' });
      const tileBox = await page.locator('.kata-tile').first().boundingBox();
      const photoBox = await page.locator('.kata-photo').boundingBox();
      await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(photoBox.x + photoBox.width / 2, photoBox.y + photoBox.height / 2, { steps: 10 });
      await page.mouse.up();
    });

    await Then('the encouraging try-again sound plays', async () => {
      await expect.poll(() => page.evaluate(() => window.__plays.length), { timeout: 5000 }).toBeGreaterThan(0);
      const plays = await page.evaluate(() => window.__plays);
      expect(plays.some((src) => src.includes('try-again.mp3'))).toBe(true);
    });
  });

  test('the victory celebration says "Selamat, kamu hebat!" and plays the celebration sounds', async ({ page }) => {
    await Given('the browser records every spoken utterance and audio clip playback', async () => {
      await page.addInitScript(() => {
        window.__spoken = [];
        window.__plays = [];
        // speechSynthesis is a read-only accessor on window, so it must be
        // replaced with defineProperty for the stub to actually take effect.
        const fakeSynth = {
          speaking: false,
          pending: false,
          paused: false,
          getVoices: () => [],
          cancel: () => {},
          resume: () => {},
          speak: (u) => {
            window.__spoken.push(u.text);
            // Fire onend so the victory fanfare (delayed until the TTS ends)
            // still plays in the test, preserving the speak-then-sfx order.
            if (typeof u.onend === 'function') u.onend();
          },
        };
        Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: function (text) { this.text = text; },
          configurable: true,
        });
        // Kata sounds are bundled .mp3 clips played through <audio> elements,
        // so record every play() call (with its src) instead.
        HTMLMediaElement.prototype.play = function () {
          window.__plays.push(String(this.src));
          return Promise.resolve();
        };
      });
    });

    await Given('Kata session length is set to 3 words', async () => {
      await setShortSession(page);
    });

    await When('the child starts Kata and completes 3 words', async () => {
      await startKata(page);
      for (let w = 0; w < 3; w++) {
        if (w > 0) {
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
      // The victory celebration is non-blocking: the next session's fresh,
      // unfilled slots prove the game kept going without a win-screen popup.
      await expect(page.locator('.kata-slot.filled')).toHaveCount(0, { timeout: 8000 });
      await expect(page.locator('.kata-scatter .kata-tile').first()).toBeVisible();
    });

    await Then('the TTS congratulates the child', async () => {
      await expect.poll(
        () => page.evaluate(() => window.__spoken.some((t) => /Selamat.*kamu hebat/.test(t))),
        { timeout: 10000 }
      ).toBe(true);
    });

    await Then('the success chime plays for each word and the victory fanfare for the session win', async () => {
      // Picking Kata on the menu plays the select sound first, then one
      // success-chime per completed word, then exactly one victory fanfare
      // when the session ends (no win-screen popup anymore — the celebration
      // plays over the continuing game). All are bundled Mixkit SFX played via
      // <audio>, so the recorded play() order proves the celebration sequence.
      await expect.poll(
        () => page.evaluate(() => window.__plays.map((src) => src.split('/').pop())),
        { timeout: 5000 }
      ).toEqual(['select-game.mp3', 'success-chime.mp3', 'success-chime.mp3', 'success-chime.mp3', 'victory-fanfare.mp3']);
    });
  });
});
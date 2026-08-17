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
      // Entering the game also plays the menu select sound (select-game.mp3),
      // so count only try-again plays: exactly one, from the tap outside.
      await expect.poll(
        () => page.evaluate(() => window.__plays.filter((p) => p.includes('try-again.mp3')).length),
        { timeout: 5000 }
      ).toBe(1);
      const plays = await page.evaluate(() => window.__plays);
      expect(plays.filter((p) => p.includes('try-again.mp3'))[0]).toContain('try-again.mp3');
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
      expect(plays.filter((p) => p.includes('try-again.mp3'))).toHaveLength(1);
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

  test('five successful target taps celebrate like Kata with TTS and fanfare', async ({ page }) => {
    await Given('the browser records every spoken utterance and audio clip playback', async () => {
      await page.addInitScript(() => {
        window.__spoken = [];
        window.__plays = [];
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
        HTMLMediaElement.prototype.play = function () {
          window.__plays.push(String(this.src));
          return Promise.resolve();
        };
      });
    });

    await Given('the user starts TepuQ Target mode', async () => {
      await startTargetMode(page);
    });

    await When('the child taps the target card five times', async () => {
      for (let i = 0; i < 5; i++) {
        // The interaction debounce (debounceMs=300) silently swallows a tap
        // right after the previous one, which is UI-undetectable; wait it out,
        // then the visible card swap proves the tap registered.
        await page.waitForTimeout(400);
        await page.locator('.card-pop.target-card').click({ force: true });
        await expect(page.locator('.card-pop.target-card img')).toBeVisible();
      }
    });

    await Then('the victory TTS congratulates the child', async () => {
      await expect.poll(
        () => page.evaluate(() => window.__spoken.some((t) => /Selamat.*kamu hebat/.test(t))),
        { timeout: 8000 }
      ).toBe(true);
    });

    await Then('the victory fanfare plays', async () => {
      await expect.poll(
        () => page.evaluate(() => window.__plays.some((p) => p.includes('victory-fanfare.mp3'))),
        { timeout: 8000 }
      ).toBe(true);
    });

    await Then('the card stays on the 5th tap object during the ~5s pause, then advances', async () => {
      const srcDuringPause = await page.locator('.card-pop.target-card img').getAttribute('src');
      // A visible celebration overlay confirms the milestone pause is active.
      await expect(page.locator('.target-celebration')).toBeVisible();
      // The next card appears only after the pause finishes.
      await expect.poll(
        async () => {
          const src = await page.locator('.card-pop.target-card img').getAttribute('src');
          return src !== srcDuringPause;
        },
        { timeout: 8000 }
      ).toBe(true);
    });
  });

  test('five target taps show a personalized username celebration when logged in', async ({ page }) => {
    let loggedIn = false;

    await Given('the browser mocks the cloud sync endpoints', async () => {
      await page.addInitScript(() => {
        window.__spoken = [];
        const fakeSynth = {
          speaking: false,
          pending: false,
          paused: false,
          getVoices: () => [],
          cancel: () => {},
          resume: () => {},
          speak: (u) => { window.__spoken.push(u.text); if (typeof u.onend === 'function') u.onend(); },
        };
        Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: function (text) { this.text = text; },
          configurable: true,
        });
      });

      await page.route('/api/login', async (route, request) => {
        const body = await request.postDataJSON();
        if (body?.user === 'anak' && body?.pass === 'rahasia') {
          loggedIn = true;
          await route.fulfill({
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': 'tepuq_session=dummy-token; Path=/; Max-Age=31536000; Secure; SameSite=Strict; HttpOnly',
            },
            body: JSON.stringify({ ok: true }),
          });
        } else {
          await route.fulfill({ status: 401, body: JSON.stringify({ ok: false }) });
        }
      });
      await page.route('/api/me', async (route) => {
        if (!loggedIn) {
          await route.fulfill({ status: 401, body: 'Unauthorized' });
          return;
        }
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: true, user: 'anak' }),
        });
      });
      await page.route('/api/sync', async (route) => {
        await route.fulfill({ status: loggedIn ? 204 : 401 });
      });
    });

    await Given('a family user logs in on the main page', async () => {
      await page.goto('/');
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
      await page.locator('#mainSyncUser').fill('anak');
      await page.locator('#mainSyncPass').fill('rahasia');
      await page.locator('#mainSyncForm button[type="submit"]').click({ force: true });
      await expect(page.locator('#mainSyncInfo')).toContainText('anak');
    });

    await When('the user starts TepuQ Target mode and taps the card five times', async () => {
      await page.locator('#btnGameGambar').click({ force: true });
      await expect(page.locator('#modePicker')).toBeVisible();
      await page.locator('#btnTarget').click({ force: true });
      await expect(page.locator('#modePicker')).toHaveClass(/hidden/);
      await expect(page.locator('.card-pop.target-card')).toBeVisible();
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(400);
        await page.locator('.card-pop.target-card').click({ force: true });
        await expect(page.locator('.card-pop.target-card img')).toBeVisible();
      }
    });

    await Then('a big celebration overlay shows the logged-in username', async () => {
      const overlay = page.locator('.target-celebration');
      await expect(overlay).toBeVisible();
      await expect(overlay).toContainText('anak');
      await expect(overlay).toContainText('Hebat');
    });

    await Then('the congratulation TTS is personalized with the username', async () => {
      await expect.poll(
        () => page.evaluate(() => window.__spoken.some((t) => /Selamat anak.*kamu hebat/.test(t))),
        { timeout: 8000 }
      ).toBe(true);
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
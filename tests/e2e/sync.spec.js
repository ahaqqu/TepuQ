import { test, expect } from '@playwright/test';

const Given = test.step;
const When = test.step;
const Then = test.step;

async function resetGameData(page) {
  await page.goto('/?mode=admin');
  await expect(page.locator('text=TepuQ Admin')).toBeVisible();
  await page.locator('#editorTabs .tab[data-editortab="settings"]').click({ force: true });
  await expect(page.locator('#btnResetAll')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#btnResetAll').click({ force: true });
  await page.waitForURL('/?mode=admin');
  await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);
}

test.describe('Cloud sync main page login', () => {
  test('logs in and hides the form when the cloud has no data', async ({ page, context }) => {
    await Given('the game is opened and the sync API is mocked', async () => {
      await resetGameData(page);
      await page.goto('/');
      await expect(page.locator('html')).not.toHaveClass(/bootstrapping/);

      let loggedIn = false;
      await page.route('/api/login', async (route, request) => {
        const body = await request.postDataJSON();
        if (body?.user === 'keluarga' && body?.pass === 'rahasia') {
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
          await route.fulfill({
            status: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: false, error: 'Invalid credentials' }),
          });
        }
      });

      await page.route('/api/sync', async (route) => {
        if (!loggedIn) {
          await route.fulfill({ status: 401, body: 'Unauthorized' });
          return;
        }
        await route.fulfill({ status: 204 });
      });

      await page.route('/api/me', async (route) => {
        if (!loggedIn) {
          await route.fulfill({ status: 401, body: 'Unauthorized' });
          return;
        }
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: true, user: 'keluarga' }),
        });
      });
    });

    await When('the parent fills in the family credentials and clicks login', async () => {
      await page.locator('#mainSyncUser').fill('keluarga');
      await page.locator('#mainSyncPass').fill('rahasia');
      await page.locator('#mainSyncForm button[type="submit"]').click({ force: true });
    });

    await Then('the status shows success and the login form is replaced by the logged-in info', async () => {
      await expect(page.locator('#mainSyncStatus')).toHaveText('Login berhasil. Belum ada data di cloud.');
      await expect(page.locator('#mainSyncForm')).toHaveCount(0);
      await expect(page.locator('#mainSyncInfo')).toBeVisible();
      await expect(page.locator('#mainSyncInfo')).toContainText('keluarga');
    });
  });
});

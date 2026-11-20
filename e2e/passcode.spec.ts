import { expect, test, type Page } from '@playwright/test';
import { BACKEND_URL } from '../src/api/client';

// A stand-in for the real backend, so tests never touch the household's sheet.
async function fakeBackend(page: Page, correctPasscode: string) {
  await page.route(BACKEND_URL, async (route) => {
    const { passcode } = route.request().postDataJSON() as { passcode: string };
    await route.fulfill({
      json:
        passcode === correctPasscode
          ? { ok: true, value: {} }
          : { ok: false, error: 'Wrong passcode.' },
    });
  });
}

/** Types on the app's own number pad, the way a person taps it. */
async function tapDigits(page: Page, digits: string) {
  for (const digit of digits) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test('a wrong passcode is rejected, the right one gets in and is remembered', async ({ page }) => {
  await fakeBackend(page, '2468');
  await page.goto('/');

  const dots = page.getByLabel('Household passcode');
  await tapDigits(page, '1111');
  await expect(dots).toHaveText('••••');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong passcode.');
  // A failed try clears the dots, so the next attempt starts fresh.
  await expect(dots).toHaveText('');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();

  await tapDigits(page, '25');
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(dots).toHaveText('•');
  await tapDigits(page, '468');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('You’re in.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('You’re in.')).toBeVisible();
  await expect(page.getByLabel('Household passcode')).toHaveCount(0);
});

test('explains when the server cannot be reached', async ({ page }) => {
  await page.route(BACKEND_URL, (route) => route.abort());
  await page.goto('/');

  await tapDigits(page, '2468');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t reach the server');
});

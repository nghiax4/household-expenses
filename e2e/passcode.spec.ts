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

test('a wrong passcode is rejected, the right one gets in and is remembered', async ({ page }) => {
  await fakeBackend(page, '2468');
  await page.goto('/');

  const passcode = page.getByLabel('Household passcode');
  // The box asks the iPhone for its digit keypad.
  await expect(passcode).toHaveAttribute('inputmode', 'numeric');
  await passcode.pressSequentially('1a1-11');
  // Only digits are kept.
  await expect(passcode).toHaveValue('1111');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong passcode.');
  // A failed try clears the box, so the next attempt starts fresh.
  await expect(passcode).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();

  await passcode.fill('2468');
  await expect(page.getByRole('alert')).toHaveText('');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('You’re in.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('You’re in.')).toBeVisible();
  await expect(page.getByLabel('Household passcode')).toHaveCount(0);
});

test('explains when the server cannot be reached', async ({ page }) => {
  await page.route(BACKEND_URL, (route) => route.abort());
  await page.goto('/');

  await page.getByLabel('Household passcode').fill('2468');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t reach the server');
});

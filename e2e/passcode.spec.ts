import { expect, test } from '@playwright/test';
import { BACKEND_URL } from '../src/api/client';
import { fakeBackend, rememberPasscode } from './fakeBackend';

test('a wrong passcode is rejected, the right one gets in and is remembered', async ({ page }) => {
  await fakeBackend(page);
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
  await expect(page.getByText('No expenses yet.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('No expenses yet.')).toBeVisible();
  await expect(page.getByLabel('Household passcode')).toHaveCount(0);
});

test('asks again when the saved passcode stops working', async ({ page }) => {
  await fakeBackend(page);
  await rememberPasscode(page, '1357');
  await page.goto('/');

  await expect(page.getByLabel('Household passcode')).toBeVisible();
  // The old passcode is forgotten, so the next visit doesn't try it again.
  expect(await page.evaluate(() => localStorage.getItem('household-expenses.passcode'))).toBeNull();
});

test('explains when the server cannot be reached', async ({ page }) => {
  await page.route(BACKEND_URL, (route) => route.abort());
  await page.goto('/');

  await page.getByLabel('Household passcode').fill('2468');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t reach the server');
});

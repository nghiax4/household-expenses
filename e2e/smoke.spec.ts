import { expect, test } from '@playwright/test';

test('app loads without errors and fits the screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Household Expenses' })).toBeVisible();
  // No sideways scrolling: the layout must fit phone width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  // Nothing may open the iOS keyboard: the app has its own (docs/requirements.md → "Input").
  await expect(page.locator('input, textarea, select, [contenteditable]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from '@playwright/test';
import type { SheetData } from '../src/api/protocol';
import { fakeBackend, PEOPLE, rememberPasscode } from './fakeBackend';

// Made-up notes (the repo is public).
const START: SheetData = {
  people: PEOPLE,
  expenses: [],
  problems: [],
  templates: [],
  templateProblems: [],
  settlements: [],
  notes: [
    { id: 1, createdAt: '2026-11-20 09:00', text: 'Paid the water bill in cash', status: 'Open' },
    { id: 2, createdAt: '2026-11-21 09:00', text: 'Already dealt with', status: 'Done' },
  ],
  noteProblems: [],
};

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await rememberPasscode(page);
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

const openNotes = (page: Page) =>
  page.getByRole('list', { name: 'Open notes' }).getByRole('listitem');

test('jots down a note, lists open notes newest first, and clears one with Done', async ({
  page,
}) => {
  const requests = await fakeBackend(page, START);
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Screens' })
    .getByRole('button', { name: 'Notes' })
    .click();

  // Only open notes are listed.
  await expect(openNotes(page)).toHaveCount(1);
  await expect(openNotes(page)).toContainText('Paid the water bill in cash');

  const box = page.getByLabel('Something came up that the app can’t handle?');
  const add = page.getByRole('button', { name: 'Add note' });
  await expect(add).toBeDisabled();
  await box.fill('Rent was split 5 ways this month\nbecause a guest stayed');
  await add.click();
  await expect(box).toHaveValue('');
  await expect(openNotes(page)).toHaveCount(2);
  // Newest first, line break kept.
  await expect(openNotes(page).first()).toContainText(
    'Rent was split 5 ways this month\nbecause a guest stayed',
  );
  expect(requests.at(-1)).toMatchObject({
    action: 'addNote',
    text: 'Rent was split 5 ways this month\nbecause a guest stayed',
  });

  await openNotes(page).last().getByRole('button', { name: /done$/ }).click();
  await expect(openNotes(page)).toHaveCount(1);
  await expect(openNotes(page)).not.toContainText('water bill');
});

test('keeps a half-typed note when switching screens', async ({ page }) => {
  await fakeBackend(page, START);
  await page.goto('/');
  const tabs = page.getByRole('navigation', { name: 'Screens' });
  await tabs.getByRole('button', { name: 'Notes' }).click();
  const box = page.getByLabel('Something came up that the app can’t handle?');
  await box.fill('Half a thought');
  await tabs.getByRole('button', { name: 'Expenses' }).click();
  await tabs.getByRole('button', { name: 'Notes' }).click();
  await expect(box).toHaveValue('Half a thought');
});

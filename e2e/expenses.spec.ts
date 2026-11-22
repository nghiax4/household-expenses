import { expect, test } from '@playwright/test';
import type { NewExpense } from '../src/domain/expense';
import type { PersonCell } from '../src/domain/personCell';
import { localDate } from '../src/ui/dates';
import { fakeBackend, PEOPLE, rememberPasscode } from './fakeBackend';

const NI: PersonCell = { kind: 'notInvolved' };
const share = (amount: number, status: 'Paid' | 'Not paid'): PersonCell => ({
  kind: 'share',
  amount,
  status,
});

// Made-up expenses (the repo is public), dated relative to today so the list order is stable.
const START = {
  people: PEOPLE,
  problems: ['Row 5: the total "10" isn’t an amount like $12.34 above $0.00.'],
  expenses: [
    {
      id: 1,
      date: localDate(3),
      description: 'Groceries',
      total: 3000,
      payer: 'Anh',
      note: '',
      deletedAt: null,
      people: { Anh: share(1500, 'Paid'), Bảo: share(1500, 'Not paid'), Chi: NI, Dương: NI },
    },
    {
      id: 2,
      date: localDate(1),
      description: 'Internet',
      total: 4000,
      payer: 'Bảo',
      note: 'November',
      deletedAt: null,
      people: {
        Anh: share(1000, 'Paid'),
        Bảo: share(1000, 'Paid'),
        Chi: share(1000, 'Not paid'),
        Dương: share(1000, 'Not paid'),
      },
    },
    {
      id: 3,
      date: localDate(0),
      description: 'In the trash',
      total: 100,
      payer: 'Anh',
      note: '',
      deletedAt: '2026-11-21 10:00',
      people: { Anh: share(100, 'Paid'), Bảo: NI, Chi: NI, Dương: NI },
    },
  ],
};

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await rememberPasscode(page);
  // A crash otherwise shows up only as a confusing timeout further down the test.
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test('lists live expenses newest first, with who has paid', async ({ page }) => {
  await fakeBackend(page, START);
  await page.goto('/');

  const cards = page
    .getByRole('list', { name: 'Expenses' })
    .getByRole('listitem')
    .filter({
      has: page.getByRole('heading'),
    });
  await expect(cards.getByRole('heading')).toHaveText(['Internet', 'Groceries']);
  const internet = cards.first();
  await expect(internet).toContainText('$40.00');
  await expect(internet).toContainText('Paid by Bảo');
  await expect(internet).toContainText('November');
  await expect(internet.getByRole('list', { name: 'Shares' }).getByRole('listitem')).toHaveText([
    '✓ Anh $10.00, paid',
    '✓ Bảo $10.00, paid',
    'Chi $10.00, not paid',
    'Dương $10.00, not paid',
  ]);
  // Not-involved people get no chip.
  await expect(
    cards.nth(1).getByRole('list', { name: 'Shares' }).getByRole('listitem'),
  ).toHaveCount(2);
  await expect(page.getByRole('status')).toContainText('Row 5: the total "10"');
});

test('adds an equal split, checking the form before saving', async ({ page }) => {
  const requests = await fakeBackend(page, START);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add expense' }).click();

  const save = page.getByRole('button', { name: 'Save' });
  const alert = page.getByRole('alert');
  // No sideways scrolling on a phone (the iPhone's date box once pushed the form wider).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await save.click();
  await expect(alert).toHaveText('Add a description.');

  // A recent description fills the box with one tap; the trash isn't offered.
  const recent = page.getByRole('group', { name: 'Recent descriptions' }).getByRole('button');
  await expect(recent).toHaveText(['Internet', 'Groceries']);
  await recent.filter({ hasText: 'Groceries' }).click();
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Groceries');

  const total = page.getByLabel('Total');
  await expect(total).toHaveAttribute('inputmode', 'decimal');
  await total.fill('10.5.');
  await save.click();
  await expect(alert).toHaveText('"10.5." isn\'t an amount. Type it like 12.50.');
  await total.fill('10');

  await page.getByRole('button', { name: 'Yesterday' }).click();
  await expect(page.getByLabel('Pick a date')).toHaveValue(localDate(1));

  const paidBy = page.getByRole('group', { name: 'Paid by' });
  const splitBetween = page.getByRole('group', { name: 'Split equally between' });
  await paidBy.getByRole('button', { name: 'Bảo' }).click();
  await save.click();
  await expect(alert).toHaveText('Pick at least one person to split with.');
  await splitBetween.getByRole('button', { name: 'Chi' }).click();
  await splitBetween.getByRole('button', { name: 'Anh' }).click();
  // Paying for others is allowed, but the form spells out what it means.
  const payerLeftOut = page.getByText('Bảo isn’t in the split, so Bảo is owed the full $10.00.');
  await expect(payerLeftOut).toBeVisible();
  await splitBetween.getByRole('button', { name: 'Bảo' }).click();
  await expect(payerLeftOut).toHaveCount(0);
  await expect(splitBetween.getByRole('button', { name: 'Anh' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // The payer absorbs the leftover cent; chips follow column order, not tap order.
  await expect(
    page.getByRole('list', { name: 'Each person’s share' }).getByRole('listitem'),
  ).toHaveText(['Anh $3.33, not paid', '✓ Bảo $3.34, paid', 'Chi $3.33, not paid']);
  await page.getByLabel('Note').fill('  Phở night ');

  await save.click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toHaveCount(0);
  const added = requests.at(-1);
  const expected: NewExpense = {
    date: localDate(1),
    description: 'Groceries',
    total: 1000,
    payer: 'Bảo',
    note: '  Phở night ',
    shares: { Anh: 333, Bảo: 334, Chi: 333 },
  };
  expect(added?.action === 'addExpense' && added.expense).toEqual(expected);
  // Same date as Internet but added later, so it comes first.
  const headings = page.getByRole('list', { name: 'Expenses' }).getByRole('heading');
  await expect(headings).toHaveText(['Groceries', 'Internet', 'Groceries']);
  await expect(page.getByText('Phở night')).toBeVisible();
});

test('cancel leaves the list unchanged', async ({ page }) => {
  const requests = await fakeBackend(page, START);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add expense' }).click();
  await page.getByLabel('Description', { exact: true }).fill('Never saved');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('list', { name: 'Expenses' }).getByRole('heading')).toHaveText([
    'Internet',
    'Groceries',
  ]);
  expect(requests.map((r) => r.action)).not.toContain('addExpense');
});

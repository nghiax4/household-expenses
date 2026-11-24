import { expect, test } from '@playwright/test';
import type { NewExpense } from '../src/domain/expense';
import type { PersonCell } from '../src/domain/personCell';
import { localDate } from '../src/ui/dates';
import { BACKEND_URL } from '../src/api/client';
import type { ApiRequest } from '../src/api/protocol';
import { fail } from '../src/domain/result';
import { fakeBackend, PASSCODE, PEOPLE, rememberPasscode } from './fakeBackend';

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
  templates: [],
  templateProblems: [],
  settlements: [],
  notes: [],
  noteProblems: [],
  expenses: [
    {
      id: 1,
      date: localDate(3),
      description: 'Groceries',
      total: 3000,
      payer: 'Anh',
      note: '',
      tags: [],
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
      tags: [],
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
      description: 'Deleted',
      total: 100,
      payer: 'Anh',
      note: '',
      tags: [],
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

  // A recent description fills the box with one tap; deleted ones aren't offered.
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
  const splitBetween = page.getByRole('group', { name: 'Split between' });
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
    tags: [],
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

test('marks who paid from a checklist, saving only on Save', async ({ page }) => {
  const requests = await fakeBackend(page, START);
  await page.goto('/');
  const internet = page
    .getByRole('list', { name: 'Expenses' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Internet' }) });
  const shares = internet.getByRole('list', { name: 'Shares' }).getByRole('listitem');
  const dialog = page.getByRole('dialog', { name: 'Who has paid back for “Internet”?' });
  const chi = dialog.getByRole('checkbox', { name: 'Chi paid back' });
  const duong = dialog.getByRole('checkbox', { name: 'Dương paid back' });

  // Cancel throws away the ticks and sends nothing.
  await internet.getByRole('button', { name: 'Mark who paid' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Anh paid back' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Bảo paid back' })).toHaveCount(0);
  await expect(dialog).toContainText('Paid the bill');
  await chi.check();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(shares).toHaveText([
    '✓ Anh $10.00, paid',
    '✓ Bảo $10.00, paid',
    'Chi $10.00, not paid',
    'Dương $10.00, not paid',
  ]);
  expect(requests.map((r) => r.action)).not.toContain('setShareStatuses');

  // Several people in one Save; only what changed is sent.
  await internet.getByRole('button', { name: 'Mark who paid' }).click();
  await expect(chi).not.toBeChecked();
  await chi.check();
  await duong.check();
  // The row shows the result before saving.
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Chi' })).toContainText('Paid back');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(shares).toHaveText([
    '✓ Anh $10.00, paid',
    '✓ Bảo $10.00, paid',
    '✓ Chi $10.00, paid',
    '✓ Dương $10.00, paid',
  ]);
  // Only the changed shares, plus the expense as this phone showed it.
  expect(requests.at(-1)).toMatchObject({
    passcode: PASSCODE,
    action: 'setShareStatuses',
    expenseId: 2,
    seen: { id: 2, description: 'Internet' },
    statuses: { Chi: 'Paid', Dương: 'Paid' },
  });
  // toMatchObject allows extra keys, so check the statuses exactly.
  expect(requests.at(-1)).toHaveProperty('statuses', { Chi: 'Paid', Dương: 'Paid' });

  // And back, for a mistaken tick.
  await internet.getByRole('button', { name: 'Mark who paid' }).click();
  await chi.uncheck();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(shares.nth(2)).toHaveText('Chi $10.00, not paid');
});

test('shows a refusal from the backend in the checklist', async ({ page }) => {
  await fakeBackend(page, START);
  await page.route(BACKEND_URL, async (route) => {
    const request = route.request().postDataJSON() as ApiRequest;
    if (request.action !== 'setShareStatuses') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      json: fail('Expense #2 is on rows 3 and 4 of the sheet. Fix that first.'),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mark who paid' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Chi paid back' }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Expense #2 is on rows 3 and 4 of the sheet. Fix that first.',
  );
});

test('an expense only the payer shares has nothing to mark', async ({ page }) => {
  const coffee = {
    id: 4,
    date: localDate(0),
    description: 'Coffee',
    total: 300,
    payer: 'Anh',
    note: '',
    tags: [],
    deletedAt: null,
    people: { Anh: share(300, 'Paid'), Bảo: NI, Chi: NI, Dương: NI },
  };
  await fakeBackend(page, { ...START, expenses: [...START.expenses, coffee] });
  await page.goto('/');
  const card = (name: string) =>
    page
      .getByRole('list', { name: 'Expenses' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name }) });
  await expect(card('Coffee').getByRole('heading')).toBeVisible();
  await expect(card('Coffee').getByRole('button', { name: 'Mark who paid' })).toHaveCount(0);
  await expect(card('Groceries').getByRole('button', { name: 'Mark who paid' })).toBeVisible();
});

test('a slow save shows a seconds counter, and gives up after a minute', async ({ page }) => {
  // Paused, so only runFor moves time: a busy test machine can't add real seconds.
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1_000));
  await fakeBackend(page, START);
  // A backend that never answers this one request.
  await page.route(BACKEND_URL, async (route) => {
    const request = route.request().postDataJSON() as ApiRequest;
    if (request.action !== 'setShareStatuses') {
      await route.fallback();
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mark who paid' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Chi paid back' }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();

  const saving = dialog.getByRole('button', { name: /^Saving…/ });
  await expect(saving).toHaveText('Saving… 0s');
  await expect(saving).toBeDisabled();
  await page.clock.runFor(5_000);
  await expect(saving).toHaveText('Saving… 5s');

  await page.clock.runFor(55_000);
  await expect(dialog.getByRole('alert')).toContainText(
    'The server didn’t answer within a minute. It may still have saved: tap Show the latest to ' +
      'check before trying again.',
  );
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('splits by typed amounts or percentages, starting from the equal split', async ({ page }) => {
  const requests = await fakeBackend(page, START);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add expense' }).click();
  await page.getByLabel('Description', { exact: true }).fill('Dinner');
  await page.getByLabel('Total').fill('10');
  await page.getByRole('group', { name: 'Paid by' }).getByRole('button', { name: 'Anh' }).click();
  const between = page.getByRole('group', { name: 'Split between' });
  await between.getByRole('button', { name: 'Anh' }).click();
  await between.getByRole('button', { name: 'Chi' }).click();
  const how = page.getByRole('group', { name: 'How to split' });
  const anh = page.getByLabel("Anh's amount");
  const chi = page.getByLabel("Chi's amount");

  await how.getByRole('button', { name: 'Amounts' }).click();
  await expect(anh).toHaveValue('5.00');
  await expect(chi).toHaveValue('5.00');
  await expect(page.getByText('✓ Adds up to $10.00')).toBeVisible();
  // A tap in the middle of a box puts the cursor after the number, not before it: the iPhone
  // keypad has no arrow keys to move it.
  await chi.click();
  expect(await chi.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(4);
  await chi.fill('4');
  await expect(page.getByText('$1.00 left to split')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'The shares add up to $9.00, but the total is $10.00.',
  );

  await how.getByRole('button', { name: 'Percent' }).click();
  const anhPercent = page.getByLabel("Anh's percentage");
  await expect(anhPercent).toHaveValue('50');
  await anhPercent.fill('70');
  await expect(page.getByText('20% too much')).toBeVisible();
  await page.getByLabel("Chi's percentage").fill('30');
  await expect(page.getByText('✓ Adds up to 100%')).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Each person’s share' }).getByRole('listitem'),
  ).toHaveText(['✓ Anh $7.00, paid', 'Chi $3.00, not paid']);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toHaveCount(0);
  const added = requests.at(-1);
  expect(added?.action === 'addExpense' && added.expense.shares).toEqual({ Anh: 700, Chi: 300 });
});

test('fades the top or bottom edge while there is more to scroll that way', async ({ page }) => {
  await fakeBackend(page, START);
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add expense' }).click();

  // The page: at the top, only "more below"; at the bottom, only "more above".
  const pageTop = page.getByTestId('fade-top').first();
  const pageBottom = page.getByTestId('fade-bottom').last();
  await expect(pageTop).toHaveClass(/opacity-0/);
  await expect(pageBottom).toHaveClass(/opacity-100/);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(pageTop).toHaveClass(/opacity-100/);
  await expect(pageBottom).toHaveClass(/opacity-0/);

  // A box that scrolls inside itself gets its own fades.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.setViewportSize({ width: 390, height: 380 });
  await page.getByRole('button', { name: 'Mark who paid' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('fade-top')).toHaveClass(/opacity-0/);
  await expect(dialog.getByTestId('fade-bottom')).toHaveClass(/opacity-100/);
  await dialog.evaluate((box) => box.scrollTo(0, box.scrollHeight));
  await expect(dialog.getByTestId('fade-top')).toHaveClass(/opacity-100/);
  await expect(dialog.getByTestId('fade-bottom')).toHaveClass(/opacity-0/);
});

test('quick fill from a template, then save', async ({ page }) => {
  const requests = await fakeBackend(page, {
    ...START,
    templates: [
      { name: 'Internet', payer: 'Bảo', participants: PEOPLE, defaultAmount: 5500 },
      { name: 'Electricity', payer: 'Anh', participants: ['Anh', 'Chi'], defaultAmount: null },
    ],
    templateProblems: ['Templates row 4: the payer "Zed" doesn’t match any person column.'],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add expense' }).click();
  await expect(page.getByRole('status')).toContainText('Templates row 4: the payer "Zed"');

  const quickFill = page.getByRole('group', { name: 'Quick fill' });
  const total = page.getByLabel('Total');
  const paidBy = page.getByRole('group', { name: 'Paid by' });
  const between = page.getByRole('group', { name: 'Split between' });
  const pressed = (group: typeof between) => group.locator('[aria-pressed="true"]');

  // A template without a default leaves Total empty, without opening the keypad (the user
  // found that annoying).
  await quickFill.getByRole('button', { name: 'Electricity' }).click();
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Electricity');
  await expect(total).toHaveValue('');
  await expect(total).not.toBeFocused();
  await expect(pressed(paidBy)).toHaveText(['Anh']);
  await expect(pressed(between)).toHaveText(['Anh', 'Chi']);

  // Another template replaces everything, people included.
  await quickFill.getByRole('button', { name: 'Internet' }).click();
  await expect(total).toHaveValue('55.00');
  await expect(pressed(paidBy)).toHaveText(['Bảo']);
  await expect(pressed(between)).toHaveText(PEOPLE);

  // The template's name is its bill tag, replacing the other template's; a typed tag is added
  // (Enter adds it rather than saving the form).
  const tags = page.getByRole('group', { name: 'Tags (optional)' });
  await expect(pressed(tags)).toHaveText(['✓ Internet']);
  await tags.getByLabel('New tag').fill('Monthly');
  await tags.getByLabel('New tag').press('Enter');
  await expect(pressed(tags)).toHaveText(['✓ Internet', '✓ Monthly']);
  await tags.getByLabel('New tag').fill('monthly');
  await tags.getByRole('button', { name: 'Add tag' }).click();
  await expect(pressed(tags)).toHaveText(['✓ Internet', '✓ Monthly']);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toHaveCount(0);
  const added = requests.at(-1);
  expect(added?.action === 'addExpense' && added.expense).toMatchObject({
    description: 'Internet',
    total: 5500,
    payer: 'Bảo',
    tags: ['Internet', 'Monthly'],
    shares: { Anh: 1375, Bảo: 1375, Chi: 1375, Dương: 1375 },
  });
  const internetCard = page
    .getByRole('list', { name: 'Expenses' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Internet' }) });
  await expect(internetCard.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText([
    'Internet',
    'Monthly',
  ]);
});

test('edits an expense, keeping who had already paid back', async ({ page }) => {
  const requests = await fakeBackend(page, START);
  await page.goto('/');
  const card = (name: string) =>
    page
      .getByRole('list', { name: 'Expenses' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name }) });
  await card('Internet').getByRole('button', { name: 'Edit' }).click();

  await expect(page.getByRole('heading', { name: 'Edit expense' })).toBeVisible();
  // Quick fill would overwrite the expense, so it's only offered for new ones.
  await expect(page.getByRole('group', { name: 'Quick fill' })).toHaveCount(0);
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Internet');
  await expect(page.getByLabel('Note')).toHaveValue('November');
  await expect(
    page.getByRole('group', { name: 'How to split' }).getByRole('button', { name: 'Equally' }),
  ).toHaveAttribute('aria-pressed', 'true');
  const total = page.getByLabel('Total');
  await expect(total).toHaveValue('40.00');
  await total.fill('48');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Edit expense' })).toHaveCount(0);
  await expect(
    card('Internet').getByRole('list', { name: 'Shares' }).getByRole('listitem'),
  ).toHaveText([
    '✓ Anh $12.00, paid',
    '✓ Bảo $12.00, paid',
    'Chi $12.00, not paid',
    'Dương $12.00, not paid',
  ]);
  expect(requests.at(-1)).toMatchObject({
    action: 'editExpense',
    expenseId: 2,
    expense: { total: 4800, shares: { Anh: 1200, Bảo: 1200, Chi: 1200, Dương: 1200 } },
  });
});

test('an uneven split reopens as typed amounts', async ({ page }) => {
  await fakeBackend(page, START);
  await page.goto('/');
  const edit = () =>
    page
      .getByRole('list', { name: 'Expenses' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Groceries' }) })
      .getByRole('button', { name: 'Edit' })
      .click();
  await edit();
  await page
    .getByRole('group', { name: 'How to split' })
    .getByRole('button', { name: 'Amounts' })
    .click();
  await page.getByLabel("Anh's amount").fill('20');
  await page.getByLabel("Bảo's amount").fill('10');
  await page.getByRole('button', { name: 'Save' }).click();

  await edit();
  await expect(
    page.getByRole('group', { name: 'How to split' }).getByRole('button', { name: 'Amounts' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel("Anh's amount")).toHaveValue('20.00');
  await expect(page.getByLabel("Bảo's amount")).toHaveValue('10.00');
});

test('deletes an expense, asking first', async ({ page }) => {
  const requests = await fakeBackend(page, START);
  await page.goto('/');
  const headings = page.getByRole('list', { name: 'Expenses' }).getByRole('heading');
  await page
    .getByRole('list', { name: 'Expenses' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Groceries' }) })
    .getByRole('button', { name: 'Edit' })
    .click();

  const confirm = page.getByRole('group', { name: 'Delete this expense?' });
  await page.getByRole('button', { name: 'Delete expense' }).click();
  await expect(confirm).toContainText('Delete “Groceries”?');
  await confirm.getByRole('button', { name: 'Keep it' }).click();
  await expect(confirm).toHaveCount(0);
  expect(requests.map((r) => r.action)).not.toContain('deleteExpense');

  await page.getByRole('button', { name: 'Delete expense' }).click();
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(headings).toHaveText(['Internet']);
  expect(requests.at(-1)).toMatchObject({ action: 'deleteExpense', expenseId: 1 });
});

test('searches the list like Ctrl+F, ignoring accents, and keeps the search across Add', async ({
  page,
}) => {
  await fakeBackend(page, START);
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search expenses' });
  const headings = page.getByRole('list', { name: 'Expenses' }).getByRole('heading');
  await expect(headings).toHaveText(['Internet', 'Groceries']);

  // A participant's name, typed without its accent, finds only the expense they're in.
  await search.fill('duong');
  await expect(headings).toHaveText(['Internet']);
  await expect(page.getByText('1 of 2 expenses')).toBeVisible();

  // The total, as typed.
  await search.fill('30.00');
  await expect(headings).toHaveText(['Groceries']);

  // The search stays while adding, so the list comes back as it was.
  await page.getByRole('button', { name: 'Add expense' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(search).toHaveValue('30.00');
  await expect(headings).toHaveText(['Groceries']);

  await search.fill('pizza');
  await expect(page.getByText('No expenses match “pizza”.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search).toHaveValue('');
  await expect(headings).toHaveText(['Internet', 'Groceries']);
});

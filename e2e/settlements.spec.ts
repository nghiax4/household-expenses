import { expect, test, type Page } from '@playwright/test';
import { BACKEND_URL } from '../src/api/client';
import type { ApiRequest, SheetData } from '../src/api/protocol';
import type { Expense } from '../src/domain/expense';
import type { PersonCell } from '../src/domain/personCell';
import type { Settlement } from '../src/domain/settlement';
import { localDate } from '../src/ui/dates';
import { fakeBackend, PASSCODE, PEOPLE, rememberPasscode } from './fakeBackend';

const NI: PersonCell = { kind: 'notInvolved' };
const share = (amount: number, status: 'Paid' | 'Not paid'): PersonCell => ({
  kind: 'share',
  amount,
  status,
});

// Made-up expenses (the repo is public). Anh paid $45.00 for Anh, Bảo and Chi; Bảo paid $35.00
// for Anh, Bảo and Dương. Settling takes two transfers: Chi → Anh $15.00, Dương → Bảo $5.00.
const START: SheetData = {
  people: PEOPLE,
  problems: [],
  templates: [],
  templateProblems: [],
  settlements: [],
  notes: [],
  noteProblems: [],
  expenses: [
    {
      id: 1,
      date: localDate(2),
      description: 'Groceries',
      total: 4500,
      payer: 'Anh',
      note: '',
      tags: [],
      deletedAt: null,
      people: {
        Anh: share(1500, 'Paid'),
        Bảo: share(1500, 'Not paid'),
        Chi: share(1500, 'Not paid'),
        Dương: NI,
      },
    },
    {
      id: 2,
      date: localDate(1),
      description: 'Internet',
      total: 3500,
      payer: 'Bảo',
      note: '',
      tags: [],
      deletedAt: null,
      people: {
        Anh: share(1500, 'Not paid'),
        Bảo: share(1500, 'Paid'),
        Chi: NI,
        Dương: share(500, 'Not paid'),
      },
    },
  ],
};

const PENDING: Settlement = {
  id: 1,
  createdAt: '2026-11-21 09:00',
  coversUpToId: 2,
  lines: [
    { from: 'Chi', to: 'Anh', amount: 1500, status: 'Not paid', paidAt: null },
    { from: 'Dương', to: 'Bảo', amount: 500, status: 'Not paid', paidAt: null },
  ],
  cancelledAt: null,
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

const tab = (page: Page, name: 'Expenses' | 'Settle up') =>
  page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name });
const card = (page: Page, name: string) =>
  page
    .getByRole('list', { name: 'Expenses' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name }) });
const transfers = (page: Page, id = 1) =>
  page.getByRole('list', { name: `Transfers of settlement #${id}` }).getByRole('listitem');

test('creates a settlement after a preview, and locks the expenses it covers', async ({ page }) => {
  const requests = await fakeBackend(page, START);
  await page.goto('/');
  await tab(page, 'Settle up').click();
  await expect(tab(page, 'Settle up')).toHaveAttribute('aria-current', 'page');

  // Cancel in the preview saves nothing.
  await page.getByRole('button', { name: 'Get total settlement' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settle up?' });
  await expect(dialog).toContainText('settle the 4 unpaid shares on 2 expenses');
  await expect(dialog.getByRole('listitem')).toHaveText([
    /Chi.*Anh\s*\$15\.00/,
    /Dương.*Bảo\s*\$5\.00/,
  ]);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  // The preview is built from the sheet read fresh, then Create saves exactly what it showed.
  await page.getByRole('button', { name: 'Get total settlement' }).click();
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).toBeHidden();
  expect(requests.filter((r) => r.action === 'createSettlement')).toEqual([
    expect.objectContaining({
      coversUpToId: 2,
      transfers: [
        { from: 'Chi', to: 'Anh', amount: 1500 },
        { from: 'Dương', to: 'Bảo', amount: 500 },
      ],
    }),
  ]);
  expect(requests.slice(-2).map((r) => r.action)).toEqual(['listExpenses', 'createSettlement']);

  await expect(page.getByRole('heading', { name: 'Settlement #1' })).toBeVisible();
  await expect(transfers(page)).toHaveText([/Chi.*Anh.*not paid/, /Dương.*Bảo.*not paid/]);
  await expect(page.getByRole('button', { name: 'Get total settlement' })).toBeHidden();

  // The covered expenses can't be changed while it's open.
  await tab(page, 'Expenses').click();
  for (const name of ['Groceries', 'Internet']) {
    await expect(card(page, name)).toContainText('In settlement #1');
    await expect(card(page, name).getByRole('button')).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'Add expense' })).toBeVisible();
});

test('ticks transfers off, and ticking the last one closes the settlement', async ({ page }) => {
  const requests = await fakeBackend(page, { ...START, settlements: [PENDING] });
  await page.goto('/');
  await tab(page, 'Settle up').click();

  const markButton = page.getByRole('button', { name: 'Mark transfers paid' });
  const dialog = page.getByRole('dialog', { name: 'Which transfers have been sent?' });
  const closesNote = dialog.getByText('saving closes the settlement');
  await markButton.click();
  await dialog.getByRole('checkbox', { name: 'Chi paid Anh' }).check();
  await expect(closesNote).toBeHidden();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(transfers(page)).toHaveText([/Chi.*Anh.*, paid/, /Dương.*Bảo.*not paid/]);
  // Money has moved, so cancelling is no longer offered.
  await expect(page.getByRole('button', { name: 'Cancel settlement' })).toBeHidden();

  await markButton.click();
  await expect(dialog.getByRole('checkbox', { name: 'Chi paid Anh' })).toBeChecked();
  await dialog.getByRole('checkbox', { name: 'Dương paid Bảo' }).check();
  await expect(closesNote).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  // Only the changed line was sent.
  expect(requests.filter((r) => r.action === 'setTransferStatuses').at(-1)).toMatchObject({
    settlementId: 1,
    statuses: [{ from: 'Dương', to: 'Bảo', status: 'Paid' }],
  });

  // Closed: it moves to the history, and a new one can be started.
  await expect(page.getByRole('button', { name: 'Get total settlement' })).toBeVisible();
  const past = page.getByRole('list', { name: 'Past settlements' }).getByRole('listitem').first();
  await expect(past).toContainText('Settlement #1');
  await expect(past).toContainText('Paid off');

  // Every covered share is now paid back, and the expenses stay locked for good.
  await tab(page, 'Expenses').click();
  await expect(
    card(page, 'Groceries').getByRole('list', { name: 'Shares' }).getByRole('listitem'),
  ).toHaveText(['✓ Anh $15.00, paid', '✓ Bảo $15.00, paid', '✓ Chi $15.00, paid']);
  await expect(card(page, 'Groceries')).toContainText('Paid off in settlement #1.');
  await expect(card(page, 'Groceries').getByRole('button')).toHaveCount(0);
});

test('cancels a settlement, asking first, which unlocks its expenses', async ({ page }) => {
  await fakeBackend(page, { ...START, settlements: [PENDING] });
  await page.goto('/');
  await tab(page, 'Settle up').click();

  const confirm = page.getByRole('group', { name: 'Cancel this settlement?' });
  await page.getByRole('button', { name: 'Cancel settlement' }).click();
  await confirm.getByRole('button', { name: 'Keep it' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Settlement #1' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel settlement' }).click();
  await confirm.getByRole('button', { name: 'Cancel it' }).click();
  await expect(page.getByRole('button', { name: 'Get total settlement' })).toBeVisible();
  const past = page.getByRole('list', { name: 'Past settlements' }).getByRole('listitem').first();
  await expect(past).toContainText('Cancelled');
  // A cancelled settlement's transfers were never owed, so they show no status.
  await expect(transfers(page)).toHaveCount(2);
  await expect(transfers(page).filter({ hasText: 'paid' })).toHaveCount(0);

  await tab(page, 'Expenses').click();
  await expect(card(page, 'Groceries').getByRole('button', { name: 'Edit' })).toBeVisible();
});

test('says so when there is nothing to settle', async ({ page }) => {
  const allPaid: SheetData = {
    ...START,
    expenses: START.expenses.slice(0, 1).map((expense) => ({
      ...expense,
      people: { ...expense.people, Bảo: share(1500, 'Paid'), Chi: share(1500, 'Paid') },
    })),
  };
  await fakeBackend(page, allPaid);
  await page.goto('/');
  await tab(page, 'Settle up').click();
  await page.getByRole('button', { name: 'Get total settlement' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Nothing to settle: every share has been paid back.',
  );
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('marks shares paid right away when they cancel each other out', async ({ page }) => {
  // Anh paid $5.00 for Bảo, and Bảo paid $5.00 for Anh: nobody needs to send money.
  const [groceries, internet] = START.expenses as [Expense, Expense];
  const evenOut: SheetData = {
    ...START,
    expenses: [
      {
        ...groceries,
        total: 500,
        people: { Anh: NI, Bảo: share(500, 'Not paid'), Chi: NI, Dương: NI },
      },
      {
        ...internet,
        total: 500,
        payer: 'Bảo',
        people: { Anh: share(500, 'Not paid'), Bảo: NI, Chi: NI, Dương: NI },
      },
    ],
  };
  await fakeBackend(page, evenOut);
  await page.goto('/');
  await tab(page, 'Settle up').click();
  await page.getByRole('button', { name: 'Get total settlement' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settle up?' });
  await expect(dialog).toContainText(
    'Nobody needs to send money: the 2 unpaid shares on 2 expenses',
  );
  await dialog.getByRole('button', { name: 'Mark all paid' }).click();
  await expect(page.getByRole('status')).toHaveText('Done: those shares are all marked paid back.');
  // No settlement was saved, so there's no history either.
  await expect(page.getByRole('list', { name: 'Past settlements' })).toBeHidden();

  await tab(page, 'Expenses').click();
  await expect(card(page, 'Groceries').getByRole('list', { name: 'Shares' })).toHaveText(
    '✓ Bảo $5.00, paid',
  );
});

/** Another phone saving something, behind this phone's back (through the same fake backend). */
async function otherPhone(page: Page, request: ApiRequest) {
  await page.evaluate(
    async ([url, body]) => {
      await fetch(url, { method: 'POST', body });
    },
    [BACKEND_URL, JSON.stringify(request)] as const,
  );
}

test('refuses a Mark who paid made on old data, and shows the latest on a tap', async ({
  page,
}) => {
  await fakeBackend(page, START);
  await page.goto('/');
  await card(page, 'Groceries').getByRole('button', { name: 'Mark who paid' }).click();
  const dialog = page.getByRole('dialog');

  await otherPhone(page, {
    passcode: PASSCODE,
    action: 'setShareStatuses',
    expenseId: 1,
    seen: START.expenses[0]!,
    statuses: { Chi: 'Paid' },
  });
  await dialog.getByRole('checkbox', { name: 'Bảo paid back' }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  // Nothing changes on screen until the user has read why.
  await expect(dialog.getByRole('alert')).toContainText('another device');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Show the latest' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    card(page, 'Groceries').getByRole('list', { name: 'Shares' }).getByRole('listitem'),
  ).toHaveText(['✓ Anh $15.00, paid', 'Bảo $15.00, not paid', '✓ Chi $15.00, paid']);
});

test('refuses ticking transfers on old data, so a settlement never closes unwarned', async ({
  page,
}) => {
  await fakeBackend(page, { ...START, settlements: [PENDING] });
  await page.goto('/');
  await tab(page, 'Settle up').click();
  await page.getByRole('button', { name: 'Mark transfers paid' }).click();
  const dialog = page.getByRole('dialog', { name: 'Which transfers have been sent?' });

  await otherPhone(page, {
    passcode: PASSCODE,
    action: 'setTransferStatuses',
    settlementId: 1,
    seen: PENDING,
    statuses: [{ from: 'Chi', to: 'Anh', status: 'Paid' }],
  });
  // This phone still shows Chi's line unticked, so it doesn't warn that saving would close it.
  await dialog.getByRole('checkbox', { name: 'Dương paid Bảo' }).check();
  await expect(dialog.getByText('saving closes the settlement')).toBeHidden();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('alert')).toContainText('another device');

  await dialog.getByRole('button', { name: 'Show the latest' }).click();
  await expect(dialog).toBeHidden();
  await expect(transfers(page)).toHaveText([/Chi.*Anh.*, paid/, /Dương.*Bảo.*not paid/]);
  await expect(page.getByRole('button', { name: 'Mark transfers paid' })).toBeVisible();
});

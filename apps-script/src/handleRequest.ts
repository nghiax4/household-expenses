import { WRONG_PASSCODE, type ApiRequest, type SheetData } from '../../src/api/protocol';
import { buildExpense, withShareStatuses, type NewExpense } from '../../src/domain/expense';
import type { ShareStatus } from '../../src/domain/personCell';
import { fail, ok, type Result } from '../../src/domain/result';
import {
  addedExpenseActivity,
  expenseRow,
  expenseRowNumber,
  nextExpenseId,
  personCell,
  personColumn,
  readExpensesTab,
  shareStatusActivity,
  type SheetCell,
} from './expensesTab';
import { readTemplatesTab } from './templatesTab';
import type { TabName } from './schema';

/** The storage spreadsheet, as the request handler sees it. */
export interface SheetStorage {
  /** Every cell of a tab as the sheet displays it, header row first. */
  readTab(tab: TabName): string[][];
  /** Adds one row below the last row of the tab. */
  appendRow(tab: TabName, cells: readonly SheetCell[]): void;
  /** Overwrites one cell. Row and column count from 1, as in the sheet (A1 is 1, 1). */
  setCell(tab: TabName, row: number, column: number, cell: SheetCell): void;
}

/** Everything a request may need from outside, passed in so the handler can be unit-tested. */
export interface Backend {
  /** The household passcode from the script's settings, or null if it was never saved. */
  passcode: string | null;
  storage: SheetStorage;
  /** The current time as written in the sheet, e.g. "2026-11-21 14:05". */
  now: () => string;
}

/** Decides what to answer, given the raw request body. Expects to run one request at a time. */
export function handleRequest(rawBody: string, backend: Backend): Result<unknown> {
  if (!backend.passcode) {
    return fail('The backend isn’t set up yet: no passcode has been saved.');
  }

  const request = parseRequest(rawBody);
  if (!request) {
    return fail('The request was malformed.');
  }
  if (request.passcode !== backend.passcode) {
    return fail(WRONG_PASSCODE);
  }

  switch (request.action) {
    case 'checkPasscode':
      return ok({});
    case 'listExpenses':
      return readSheet(backend.storage);
    case 'addExpense':
      return addExpense(request.expense, backend);
    case 'setShareStatuses':
      return setShareStatuses(request, backend);
  }
}

function addExpense(input: NewExpense, { storage, now }: Backend): Result<SheetData> {
  const rows = storage.readTab('Expenses');
  const current = readExpensesTab(rows);
  if (!current.ok) {
    return current;
  }
  const { people } = current.value;
  const expense = buildExpense(input, nextExpenseId(rows), people);
  if (!expense.ok) {
    return fail(expense.error);
  }

  storage.appendRow('Expenses', expenseRow(expense.value, people));
  storage.appendRow('Activity', addedExpenseActivity(now(), expense.value, people));
  return readSheet(storage);
}

function setShareStatuses(
  { expenseId, statuses }: ShareStatusesRequest,
  { storage, now }: Backend,
): Result<SheetData> {
  const rows = storage.readTab('Expenses');
  const current = readExpensesTab(rows);
  if (!current.ok) {
    return current;
  }
  const { people, expenses } = current.value;
  const rowNumber = expenseRowNumber(rows, expenseId);
  if (!rowNumber.ok) {
    return fail(rowNumber.error);
  }
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) {
    return fail(`Expense #${expenseId} can't be read. Fix its row in the sheet first.`);
  }
  // Every change is checked before anything is written, so a refusal leaves the sheet as it was.
  const updated = withShareStatuses(expense, statuses);
  if (!updated.ok) {
    return fail(updated.error);
  }

  for (const person of people) {
    const before = expense.people[person];
    const after = updated.value.people[person];
    // Unchanged shares (say, another phone got there first) are neither written nor logged.
    if (before?.kind === 'share' && after?.kind === 'share' && before.status !== after.status) {
      storage.setCell(
        'Expenses',
        rowNumber.value,
        personColumn(people, person),
        personCell(updated.value, person),
      );
      storage.appendRow(
        'Activity',
        shareStatusActivity(now(), expense, person, after.amount, after.status),
      );
    }
  }
  return readSheet(storage);
}

/**
 * Everything the app shows, read fresh. Writes end with this too, so the app shows exactly
 * what's stored rather than what it asked for.
 */
function readSheet(storage: SheetStorage): Result<SheetData> {
  const expenses = readExpensesTab(storage.readTab('Expenses'));
  if (!expenses.ok) {
    return expenses;
  }
  const { templates, problems } = readTemplatesTab(
    storage.readTab('Templates'),
    expenses.value.people,
  );
  return ok({ ...expenses.value, templates, templateProblems: problems });
}

type ShareStatusesRequest = Extract<ApiRequest, { action: 'setShareStatuses' }>;

/** Checks the shape of a request. Business rules (who exists, sums) are checked later. */
function parseRequest(rawBody: string): ApiRequest | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isRecord(body) || typeof body.passcode !== 'string') {
    return null;
  }

  const { passcode, action } = body;
  switch (action) {
    case 'checkPasscode':
    case 'listExpenses':
      return { passcode, action };
    case 'addExpense': {
      const expense = parseNewExpense(body.expense);
      return expense && { passcode, action, expense };
    }
    case 'setShareStatuses': {
      const { expenseId, statuses } = body;
      if (
        typeof expenseId !== 'number' ||
        !Number.isSafeInteger(expenseId) ||
        !isRecord(statuses)
      ) {
        return null;
      }
      const entries = Object.entries(statuses);
      if (!entries.every((entry): entry is [string, ShareStatus] => isShareStatus(entry[1]))) {
        return null;
      }
      return { passcode, action, expenseId, statuses: Object.fromEntries(entries) };
    }
    default:
      return null;
  }
}

function parseNewExpense(value: unknown): NewExpense | null {
  if (!isRecord(value)) {
    return null;
  }
  const { date, description, total, payer, note, shares } = value;
  if (
    typeof date !== 'string' ||
    typeof description !== 'string' ||
    typeof total !== 'number' ||
    typeof payer !== 'string' ||
    typeof note !== 'string' ||
    !isRecord(shares)
  ) {
    return null;
  }
  const amounts = Object.entries(shares);
  if (!amounts.every((entry): entry is [string, number] => typeof entry[1] === 'number')) {
    return null;
  }
  return { date, description, total, payer, note, shares: Object.fromEntries(amounts) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShareStatus(value: unknown): value is ShareStatus {
  return value === 'Paid' || value === 'Not paid';
}

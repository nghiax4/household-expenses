import { WRONG_PASSCODE, type ApiRequest, type ExpensesData } from '../../src/api/protocol';
import { buildExpense, type NewExpense } from '../../src/domain/expense';
import { fail, ok, type Result } from '../../src/domain/result';
import {
  addedExpenseActivity,
  expenseRow,
  nextExpenseId,
  readExpensesTab,
  type SheetCell,
} from './expensesTab';
import type { TabName } from './schema';

/** The storage spreadsheet, as the request handler sees it. */
export interface SheetStorage {
  /** Every cell of a tab as the sheet displays it, header row first. */
  readTab(tab: TabName): string[][];
  /** Adds one row below the last row of the tab. */
  appendRow(tab: TabName, cells: readonly SheetCell[]): void;
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
      return readExpensesTab(backend.storage.readTab('Expenses'));
    case 'addExpense':
      return addExpense(request.expense, backend);
  }
}

function addExpense(input: NewExpense, { storage, now }: Backend): Result<ExpensesData> {
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
  // Read back rather than trusting what was written, so the app shows exactly what's stored.
  return readExpensesTab(storage.readTab('Expenses'));
}

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

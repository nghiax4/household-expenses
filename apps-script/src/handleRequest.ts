import { WRONG_PASSCODE, type ApiRequest, type SheetData } from '../../src/api/protocol';
import {
  buildExpense,
  carryOverStatuses,
  withShareStatuses,
  type Expense,
  type NewExpense,
} from '../../src/domain/expense';
import type { PersonName } from '../../src/domain/money';
import { fail, ok, type Result } from '../../src/domain/result';
import { sameData } from '../../src/domain/sameData';
import {
  coveringSettlement,
  paidOffExpenses,
  pendingSettlement,
  proposeSettlement,
  sameTransfers,
  settlementState,
  withTransferStatuses,
  type Settlement,
  type Transfer,
} from '../../src/domain/settlement';
import { literal, type SheetCell } from './cells';
import {
  addedExpenseActivity,
  deletedExpenseActivity,
  editedExpenseActivity,
  expenseChanges,
  expenseRow,
  expenseRowNumber,
  nextExpenseId,
  personCell,
  personColumn,
  readExpensesTab,
  shareStatusActivity,
} from './expensesTab';
import { parseRequest } from './parseRequest';
import type { TabName } from './schema';
import {
  cancelledSettlementActivity,
  closedSettlementActivity,
  createdSettlementActivity,
  nextSettlementId,
  readSettlementsTab,
  SETTLEMENT_COLUMNS,
  settledWithoutTransfersActivity,
  settlementLineRow,
  settlementRows,
  transferStatusActivity,
} from './settlementsTab';
import { readTemplatesTab } from './templatesTab';

/** The storage spreadsheet, as the request handler sees it. */
export interface SheetStorage {
  /** Every cell of a tab as the sheet displays it, header row first. */
  readTab(tab: TabName): string[][];
  /** Adds one row below the last row of the tab. */
  appendRow(tab: TabName, cells: readonly SheetCell[]): void;
  /** Overwrites one cell. Row and column count from 1, as in the sheet (A1 is 1, 1). */
  setCell(tab: TabName, row: number, column: number, cell: SheetCell): void;
  /** Overwrites a row from column A, one cell per item. Rows count from 1 (the header). */
  setRow(tab: TabName, row: number, cells: readonly SheetCell[]): void;
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
    case 'editExpense':
      return editExpense(request, backend);
    case 'deleteExpense':
      return deleteExpense(request, backend);
    case 'createSettlement':
      return createSettlement(request.coversUpToId, request.transfers, backend);
    case 'setTransferStatuses':
      return setTransferStatuses(request, backend);
    case 'cancelSettlement':
      return cancelSettlement(request, backend);
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
  { expenseId, seen, statuses }: RequestFor<'setShareStatuses'>,
  { storage, now }: Backend,
): Result<SheetData> {
  const found = findChangeableExpense(storage, expenseId, seen);
  if (!found.ok) {
    return found;
  }
  const { people, expense, rowNumber } = found.value;
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
        rowNumber,
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

function editExpense(
  { expenseId, seen, expense: input }: RequestFor<'editExpense'>,
  { storage, now }: Backend,
): Result<SheetData> {
  const found = findChangeableExpense(storage, expenseId, seen);
  if (!found.ok) {
    return found;
  }
  const { people, expense: before, rowNumber } = found.value;
  const built = buildExpense(input, expenseId, people);
  if (!built.ok) {
    return fail(built.error);
  }
  const after = carryOverStatuses(before, built.value);
  const changes = expenseChanges(before, after, people);
  // Saving the form unchanged (or a repeat of the same edit) writes and logs nothing.
  if (changes.length > 0) {
    storage.setRow('Expenses', rowNumber, expenseRow(after, people));
    storage.appendRow('Activity', editedExpenseActivity(now(), before, changes));
  }
  return readSheet(storage);
}

/**
 * Hides an expense by filling in its "Deleted at" cell. The row stays in the sheet, so expense
 * IDs are never reused (settlements rely on that) and a mistake can be undone by hand.
 */
function deleteExpense(
  { expenseId, seen }: RequestFor<'deleteExpense'>,
  { storage, now }: Backend,
): Result<SheetData> {
  const found = findChangeableExpense(storage, expenseId, seen);
  if (!found.ok) {
    return found;
  }
  const { people, expense, rowNumber } = found.value;
  const time = now();
  storage.setRow('Expenses', rowNumber, expenseRow({ ...expense, deletedAt: time }, people));
  storage.appendRow('Activity', deletedExpenseActivity(time, expense, people));
  return readSheet(storage);
}

/**
 * A live expense, unchanged since the phone showed it (`seen`), that no settlement locks; where
 * its row is, and the household. Or why it can't be changed.
 */
function findChangeableExpense(
  storage: SheetStorage,
  expenseId: number,
  seen: Expense,
): Result<{ people: PersonName[]; expense: Expense; rowNumber: number }> {
  const rows = storage.readTab('Expenses');
  const current = readExpensesTab(rows);
  if (!current.ok) {
    return fail(current.error);
  }
  const rowNumber = expenseRowNumber(rows, expenseId);
  if (!rowNumber.ok) {
    return fail(rowNumber.error);
  }
  const expense = current.value.expenses.find((e) => e.id === expenseId);
  if (!expense) {
    return fail(`Expense #${expenseId} can't be read. Fix its row in the sheet first.`);
  }
  if (expense.deletedAt !== null) {
    return fail(`"${expense.description}" was deleted.`);
  }
  if (!sameData(expense, seen)) {
    return fail(
      `"${expense.description}" was changed on another device since you opened this, so ` +
        'nothing was saved.',
    );
  }
  const settlements = readSettlementsTab(storage.readTab('Settlements'), current.value.people);
  if (!settlements.ok) {
    return fail(settlements.error);
  }
  const lock = coveringSettlement(settlements.value, expenseId);
  if (lock && settlementState(lock) === 'closed') {
    return fail(
      `"${expense.description}" was paid off in settlement #${lock.id}, so it can’t be ` +
        'changed anymore. If something about it is wrong, fix it in the sheet.',
    );
  }
  if (lock) {
    return fail(
      `"${expense.description}" is in settlement #${lock.id}, so it can’t be changed unless ` +
        'that settlement is cancelled.',
    );
  }
  return ok({ people: current.value.people, expense, rowNumber: rowNumber.value });
}

function changedSettlement(settlementId: number): string {
  return (
    `Settlement #${settlementId} was changed on another device since you opened this, so ` +
    'nothing was saved.'
  );
}

const UNREADABLE_EXPENSES =
  'Some rows in the Expenses tab can’t be read, so a settlement could miss what they owe. ' +
  'Fix them in the sheet first.';

/**
 * Saves the settlement the app previewed: one Settlements row per transfer. If the unpaid shares
 * cancel out, there's nothing to send, so they're marked Paid right away instead.
 */
function createSettlement(
  coversUpToId: number,
  transfers: readonly Transfer[],
  { storage, now }: Backend,
): Result<SheetData> {
  const sheet = readSheet(storage);
  if (!sheet.ok) {
    return sheet;
  }
  const { people, expenses, problems, settlements } = sheet.value;
  if (problems.length > 0) {
    return fail(UNREADABLE_EXPENSES);
  }
  const pending = pendingSettlement(settlements);
  if (pending) {
    return fail(`Settlement #${pending.id} is still open. Finish or cancel it first.`);
  }
  const proposal = proposeSettlement(expenses, people);
  if (!proposal) {
    return fail('Nothing to settle: every share has been paid back.');
  }
  if (proposal.coversUpToId !== coversUpToId || !sameTransfers(proposal.transfers, transfers)) {
    return fail(
      'Something changed since you opened this (another device saved), so nothing was saved. ' +
        'Tap Get total settlement again to see the new transfers.',
    );
  }

  const time = now();
  if (proposal.transfers.length === 0) {
    const paidOff = payOff(storage, people, expenses, coversUpToId);
    storage.appendRow(
      'Activity',
      settledWithoutTransfersActivity(time, coversUpToId, paidOff, people),
    );
    return readSheet(storage);
  }
  const settlement: Settlement = {
    id: nextSettlementId(storage.readTab('Settlements')),
    createdAt: time,
    coversUpToId,
    lines: proposal.transfers.map((t) => ({ ...t, status: 'Not paid', paidAt: null })),
    cancelledAt: null,
  };
  for (const row of settlementRows(settlement)) {
    storage.appendRow('Settlements', row);
  }
  storage.appendRow('Activity', createdSettlementActivity(time, settlement));
  return readSheet(storage);
}

/**
 * Ticks transfers off (or back on). When the last one is ticked, the settlement closes: every
 * Not paid share it covers becomes Paid, in the same request.
 */
function setTransferStatuses(
  { settlementId, seen, statuses }: RequestFor<'setTransferStatuses'>,
  { storage, now }: Backend,
): Result<SheetData> {
  const sheet = readSheet(storage);
  if (!sheet.ok) {
    return sheet;
  }
  const { people, expenses, problems, settlements } = sheet.value;
  const settlement = settlements.find((s) => s.id === settlementId);
  if (!settlement) {
    return fail(`Settlement #${settlementId} isn't in the sheet anymore. Reload the app.`);
  }
  if (!sameData(settlement, seen)) {
    return fail(changedSettlement(settlementId));
  }
  const time = now();
  // Every change is checked before anything is written, so a refusal leaves the sheet as it was.
  const updated = withTransferStatuses(settlement, statuses, time);
  if (!updated.ok) {
    return fail(updated.error);
  }
  const closing = settlementState(updated.value) === 'closed';
  if (closing && problems.length > 0) {
    return fail(UNREADABLE_EXPENSES);
  }

  const rows = storage.readTab('Settlements');
  updated.value.lines.forEach((line, i) => {
    // Unchanged lines (say, another phone got there first) are neither written nor logged.
    if (line.status === settlement.lines[i]?.status) {
      return;
    }
    const row = settlementLineRow(rows, settlementId, line);
    storage.setCell('Settlements', row, SETTLEMENT_COLUMNS.paid, literal(line.status));
    storage.setCell('Settlements', row, SETTLEMENT_COLUMNS.paidAt, literal(line.paidAt ?? ''));
    storage.appendRow('Activity', transferStatusActivity(time, settlementId, line, line.status));
  });
  if (closing) {
    const paidOff = payOff(storage, people, expenses, settlement.coversUpToId);
    storage.appendRow('Activity', closedSettlementActivity(time, updated.value, paidOff, people));
  }
  return readSheet(storage);
}

/**
 * Cancels a settlement nobody has paid into yet, unlocking its expenses. Its rows stay, with
 * "Cancelled at" filled in, so the history is kept and its ID is never reused.
 */
function cancelSettlement(
  { settlementId, seen }: RequestFor<'cancelSettlement'>,
  { storage, now }: Backend,
): Result<SheetData> {
  const sheet = readSheet(storage);
  if (!sheet.ok) {
    return sheet;
  }
  const settlement = sheet.value.settlements.find((s) => s.id === settlementId);
  if (!settlement) {
    return fail(`Settlement #${settlementId} isn't in the sheet anymore. Reload the app.`);
  }
  if (!sameData(settlement, seen)) {
    return fail(changedSettlement(settlementId));
  }
  const state = settlementState(settlement);
  if (state === 'cancelled') {
    return fail(`Settlement #${settlementId} was already cancelled.`);
  }
  if (state === 'closed') {
    return fail(`Settlement #${settlementId} is closed: every transfer was paid.`);
  }
  // Money has already moved for a ticked line; dropping it would hide that.
  if (settlement.lines.some((line) => line.status === 'Paid')) {
    return fail(
      `Settlement #${settlementId} can’t be cancelled while transfers are marked paid. ` +
        'Untick them first.',
    );
  }

  const time = now();
  const rows = storage.readTab('Settlements');
  for (const line of settlement.lines) {
    const row = settlementLineRow(rows, settlementId, line);
    storage.setCell('Settlements', row, SETTLEMENT_COLUMNS.cancelledAt, literal(time));
  }
  storage.appendRow('Activity', cancelledSettlementActivity(time, settlement));
  return readSheet(storage);
}

/**
 * Marks every Not paid share on live expenses up to #N Paid, writing only the cells that change.
 * Returns those expenses as they were before, for the Activity entry.
 */
function payOff(
  storage: SheetStorage,
  people: readonly PersonName[],
  expenses: readonly Expense[],
  coversUpToId: number,
): Expense[] {
  const rows = storage.readTab('Expenses');
  return paidOffExpenses(expenses, coversUpToId).map((after) => {
    const before = expenses.find((e) => e.id === after.id)!;
    const rowNumber = expenseRowNumber(rows, after.id);
    if (!rowNumber.ok) {
      // Callers refuse when any Expenses row is unreadable, and a duplicated ID is unreadable.
      throw new Error(rowNumber.error);
    }
    for (const person of people) {
      const cell = before.people[person];
      if (cell?.kind === 'share' && cell.status === 'Not paid') {
        storage.setCell(
          'Expenses',
          rowNumber.value,
          personColumn(people, person),
          personCell(after, person),
        );
      }
    }
    return before;
  });
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
  const { people } = expenses.value;
  const settlements = readSettlementsTab(storage.readTab('Settlements'), people);
  if (!settlements.ok) {
    return fail(settlements.error);
  }
  const { templates, problems } = readTemplatesTab(storage.readTab('Templates'), people);
  return ok({
    ...expenses.value,
    templates,
    templateProblems: problems,
    settlements: settlements.value,
  });
}

type RequestFor<A extends ApiRequest['action']> = Extract<ApiRequest, { action: A }>;

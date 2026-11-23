// The request/response format between the app and the Apps Script backend. Shared by both
// sides, so they can't disagree.
import type { Expense, NewExpense } from '../domain/expense';
import type { PersonName } from '../domain/money';
import type { Note } from '../domain/note';
import type { ShareStatus } from '../domain/personCell';
import type { Result } from '../domain/result';
import type { Settlement, Transfer, TransferStatus } from '../domain/settlement';
import type { Template } from '../domain/template';

/** Every request carries the household passcode; the backend rejects it otherwise. */
export type ApiRequest = { passcode: string } & (
  | { action: 'checkPasscode' }
  | { action: 'listExpenses' }
  | { action: 'addExpense'; expense: NewExpense }
  // `seen` in the requests below is the expense or settlement as the phone showed it. If the
  // sheet now holds anything different (another phone changed it), the save is refused, so a
  // phone showing old data can't undo or misapply a newer change.
  // The whole expense as the form now has it; who had already paid back is kept.
  | { action: 'editExpense'; expenseId: number; seen: Expense; expense: NewExpense }
  | { action: 'deleteExpense'; expenseId: number; seen: Expense }
  // The new statuses rather than "toggle", so a retried save changes nothing.
  | {
      action: 'setShareStatuses';
      expenseId: number;
      seen: Expense;
      statuses: Record<PersonName, ShareStatus>;
    }
  // What the preview showed. Refused if the sheet would now give something else (another phone
  // saved in between), so nobody creates a settlement they didn't see.
  | { action: 'createSettlement'; coversUpToId: number; transfers: Transfer[] }
  // New statuses, like setShareStatuses. Ticking the last line closes the settlement.
  | {
      action: 'setTransferStatuses';
      settlementId: number;
      seen: Settlement;
      statuses: TransferStatus[];
    }
  | { action: 'cancelSettlement'; settlementId: number; seen: Settlement }
  // Notes don't touch money, so they need no `seen`: adding never clashes, and closing a note
  // that's already closed changes nothing.
  | { action: 'addNote'; text: string }
  | { action: 'closeNote'; noteId: number }
);

export type ApiAction = ApiRequest['action'];

/** Everything the app reads from the storage sheet: the Expenses, Templates and Settlements tabs. */
export interface SheetData {
  /** Everyone with a column in Expenses, in column order. */
  people: PersonName[];
  /** Every readable row, including deleted ones (which the app hides). */
  expenses: Expense[];
  /**
   * Expenses rows that couldn't be read, explained for whoever fixes them in the sheet. They're
   * left out of `expenses` rather than guessed at.
   */
  problems: string[];
  /** Quick-fill presets, typed by hand in the Templates tab (the app only reads them). */
  templates: Template[];
  /** Templates rows that couldn't be read, explained the same way. */
  templateProblems: string[];
  /** Every settlement, oldest first: at most one pending, then closed and cancelled ones. */
  settlements: Settlement[];
  /** Every note in the Ideas tab: cases that came up, jotted down to bring to Claude. */
  notes: Note[];
  /** Ideas rows that couldn't be read, explained the same way. */
  noteProblems: string[];
}

/** What each action returns when it succeeds. */
export interface ApiResults {
  checkPasscode: Record<string, never>;
  listExpenses: SheetData;
  /** The whole sheet again, read back after saving, so the app shows exactly what's stored. */
  addExpense: SheetData;
  /** Read back the same way. */
  setShareStatuses: SheetData;
  editExpense: SheetData;
  deleteExpense: SheetData;
  createSettlement: SheetData;
  setTransferStatuses: SheetData;
  cancelSettlement: SheetData;
  addNote: SheetData;
  closeNote: SheetData;
}

export type ApiResponse<A extends ApiAction> = Result<ApiResults[A]>;

/** The error for a wrong passcode. The app recognizes it to ask for the passcode again. */
export const WRONG_PASSCODE = 'Wrong passcode.';

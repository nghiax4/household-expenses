// The request/response format between the app and the Apps Script backend. Shared by both
// sides, so they can't disagree.
import type { Expense, NewExpense } from '../domain/expense';
import type { PersonName } from '../domain/money';
import type { ShareStatus } from '../domain/personCell';
import type { Template } from '../domain/template';
import type { Result } from '../domain/result';

/** Every request carries the household passcode; the backend rejects it otherwise. */
export type ApiRequest = { passcode: string } & (
  | { action: 'checkPasscode' }
  | { action: 'listExpenses' }
  | { action: 'addExpense'; expense: NewExpense }
  // The whole expense as the form now has it; who had already paid back is kept.
  | { action: 'editExpense'; expenseId: number; expense: NewExpense }
  | { action: 'deleteExpense'; expenseId: number }
  // The new statuses rather than "toggle", so a phone showing an old list can't flip one back.
  | {
      action: 'setShareStatuses';
      expenseId: number;
      statuses: Record<PersonName, ShareStatus>;
    }
);

export type ApiAction = ApiRequest['action'];

/** Everything the app reads from the storage sheet: the Expenses tab, plus the Templates tab. */
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
}

export type ApiResponse<A extends ApiAction> = Result<ApiResults[A]>;

/** The error for a wrong passcode. The app recognizes it to ask for the passcode again. */
export const WRONG_PASSCODE = 'Wrong passcode.';

// The request/response format between the app and the Apps Script backend. Shared by both
// sides, so they can't disagree.
import type { Expense, NewExpense } from '../domain/expense';
import type { PersonName } from '../domain/money';
import type { ShareStatus } from '../domain/personCell';
import type { Result } from '../domain/result';

/** Every request carries the household passcode; the backend rejects it otherwise. */
export type ApiRequest = { passcode: string } & (
  | { action: 'checkPasscode' }
  | { action: 'listExpenses' }
  | { action: 'addExpense'; expense: NewExpense }
  // The new statuses rather than "toggle", so a phone showing an old list can't flip one back.
  | {
      action: 'setShareStatuses';
      expenseId: number;
      statuses: Record<PersonName, ShareStatus>;
    }
);

export type ApiAction = ApiRequest['action'];

/** Everything on the Expenses tab, as the app needs it. */
export interface ExpensesData {
  /** Everyone with a column in Expenses, in column order. */
  people: PersonName[];
  /** Every readable row, including the ones in the trash. */
  expenses: Expense[];
  /**
   * Rows that couldn't be read, explained for whoever fixes them in the sheet. They're left
   * out of `expenses` rather than guessed at.
   */
  problems: string[];
}

/** What each action returns when it succeeds. */
export interface ApiResults {
  checkPasscode: Record<string, never>;
  listExpenses: ExpensesData;
  /** The whole tab again, read back after saving, so the app shows exactly what's stored. */
  addExpense: ExpensesData;
  /** Read back the same way. */
  setShareStatuses: ExpensesData;
}

export type ApiResponse<A extends ApiAction> = Result<ApiResults[A]>;

/** The error for a wrong passcode. The app recognizes it to ask for the passcode again. */
export const WRONG_PASSCODE = 'Wrong passcode.';

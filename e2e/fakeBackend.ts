import type { Page } from '@playwright/test';
import { BACKEND_URL } from '../src/api/client';
import { WRONG_PASSCODE, type ApiRequest, type SheetData } from '../src/api/protocol';
import { buildExpense, withShareStatuses, type Expense } from '../src/domain/expense';
import { fail, ok, type Result } from '../src/domain/result';

// Made-up people (the repo is public), in person-column order.
export const PEOPLE = ['Anh', 'Bảo', 'Chi', 'Dương'];
export const PASSCODE = '2468';

/**
 * A stand-in for the real backend, so tests never touch the household's sheet. It keeps
 * expenses in memory and checks changes with the same rules as the real backend. Returns
 * every request it received, newest last.
 */
export async function fakeBackend(
  page: Page,
  start: SheetData = {
    people: PEOPLE,
    expenses: [],
    problems: [],
    templates: [],
    templateProblems: [],
  },
): Promise<ApiRequest[]> {
  let data = start;
  const requests: ApiRequest[] = [];
  await page.route(BACKEND_URL, async (route) => {
    const request = route.request().postDataJSON() as ApiRequest;
    requests.push(request);
    if (request.passcode !== PASSCODE) {
      await route.fulfill({ json: fail(WRONG_PASSCODE) });
      return;
    }
    switch (request.action) {
      case 'checkPasscode':
        await route.fulfill({ json: ok({}) });
        return;
      case 'listExpenses':
        await route.fulfill({ json: ok(data) });
        return;
      case 'addExpense': {
        const nextId = Math.max(0, ...data.expenses.map((e) => e.id)) + 1;
        const expense = buildExpense(request.expense, nextId, data.people);
        if (expense.ok) {
          data = { ...data, expenses: [...data.expenses, expense.value] };
        }
        await route.fulfill({ json: expense.ok ? ok(data) : expense });
        return;
      }
      case 'setShareStatuses': {
        const expense = data.expenses.find((e) => e.id === request.expenseId);
        const updated: Result<Expense> = expense
          ? withShareStatuses(expense, request.statuses)
          : fail(`Expense #${request.expenseId} isn't in the sheet anymore. Reload the list.`);
        if (updated.ok) {
          data = {
            ...data,
            expenses: data.expenses.map((e) => (e.id === request.expenseId ? updated.value : e)),
          };
        }
        await route.fulfill({ json: updated.ok ? ok(data) : updated });
        return;
      }
    }
  });
  return requests;
}

/** Starts the app already unlocked, as on a phone that entered the passcode before. */
export async function rememberPasscode(page: Page, passcode = PASSCODE): Promise<void> {
  await page.addInitScript((saved) => {
    localStorage.setItem('household-expenses.passcode', saved);
  }, passcode);
}

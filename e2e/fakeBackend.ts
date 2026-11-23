import type { Page } from '@playwright/test';
import { BACKEND_URL } from '../src/api/client';
import { WRONG_PASSCODE, type ApiRequest, type SheetData } from '../src/api/protocol';
import {
  buildExpense,
  carryOverStatuses,
  withShareStatuses,
  type Expense,
} from '../src/domain/expense';
import { fail, ok, type Result } from '../src/domain/result';
import { sameData } from '../src/domain/sameData';
import {
  coveringSettlement,
  paidOffExpenses,
  proposeSettlement,
  sameTransfers,
  settlementState,
  withTransferStatuses,
  type Settlement,
} from '../src/domain/settlement';

// Made-up people (the repo is public), in person-column order.
export const PEOPLE = ['Anh', 'Bảo', 'Chi', 'Dương'];
export const PASSCODE = '2468';
export const NOW = '2026-11-22 12:00';

/**
 * A stand-in for the real backend, so tests never touch the household's sheet. It keeps the
 * data in memory and checks changes with the same domain rules as the real backend (the
 * backend's own unit tests cover the rest). Returns every request it received, newest last.
 */
export async function fakeBackend(
  page: Page,
  start: SheetData = {
    people: PEOPLE,
    expenses: [],
    problems: [],
    templates: [],
    templateProblems: [],
    settlements: [],
    notes: [],
    noteProblems: [],
  },
): Promise<ApiRequest[]> {
  let data = start;
  const requests: ApiRequest[] = [];
  await page.route(BACKEND_URL, async (route) => {
    const request = route.request().postDataJSON() as ApiRequest;
    requests.push(request);
    const result = request.passcode === PASSCODE ? answer(request) : fail(WRONG_PASSCODE);
    await route.fulfill({ json: result });
  });
  return requests;

  /** Applies the request to `data` and says what the backend would answer. */
  function answer(request: ApiRequest): Result<unknown> {
    const replaceExpense = (expense: Expense) => {
      data = { ...data, expenses: data.expenses.map((e) => (e.id === expense.id ? expense : e)) };
    };
    // Like the backend: refused if this phone saw something other than what's stored now.
    const staleOrLocked = (expenseId: number, seen: Expense): Result<never> | null => {
      const current = data.expenses.find((e) => e.id === expenseId);
      if (!sameData(current, seen)) {
        return fail(
          `"${current?.description}" was changed on another device since you opened this, so ` +
            'nothing was saved.',
        );
      }
      const lock = coveringSettlement(data.settlements, expenseId);
      return lock && fail(`In settlement #${lock.id}.`);
    };
    const staleSettlement = (settlementId: number, seen: Settlement): Result<never> | null =>
      sameData(
        data.settlements.find((s) => s.id === settlementId),
        seen,
      )
        ? null
        : fail(
            `Settlement #${settlementId} was changed on another device since you opened this, so ` +
              'nothing was saved.',
          );

    switch (request.action) {
      case 'checkPasscode':
        return ok({});
      case 'listExpenses':
        return ok(data);
      case 'addExpense': {
        const nextId = Math.max(0, ...data.expenses.map((e) => e.id)) + 1;
        const expense = buildExpense(request.expense, nextId, data.people);
        if (!expense.ok) {
          return expense;
        }
        data = { ...data, expenses: [...data.expenses, expense.value] };
        return ok(data);
      }
      case 'editExpense': {
        const locked = staleOrLocked(request.expenseId, request.seen);
        if (locked) {
          return locked;
        }
        const before = data.expenses.find((e) => e.id === request.expenseId);
        const built = buildExpense(request.expense, request.expenseId, data.people);
        if (!built.ok) {
          return built;
        }
        if (before) {
          replaceExpense(carryOverStatuses(before, built.value));
        }
        return ok(data);
      }
      case 'deleteExpense': {
        const locked = staleOrLocked(request.expenseId, request.seen);
        if (locked) {
          return locked;
        }
        const expense = data.expenses.find((e) => e.id === request.expenseId);
        if (expense) {
          replaceExpense({ ...expense, deletedAt: NOW });
        }
        return ok(data);
      }
      case 'setShareStatuses': {
        const locked = staleOrLocked(request.expenseId, request.seen);
        if (locked) {
          return locked;
        }
        const expense = data.expenses.find((e) => e.id === request.expenseId);
        const updated = expense
          ? withShareStatuses(expense, request.statuses)
          : fail<Expense>(`Expense #${request.expenseId} isn't in the sheet anymore.`);
        if (!updated.ok) {
          return updated;
        }
        replaceExpense(updated.value);
        return ok(data);
      }
      case 'createSettlement': {
        const proposal = proposeSettlement(data.expenses, data.people);
        if (
          !proposal ||
          proposal.coversUpToId !== request.coversUpToId ||
          !sameTransfers(proposal.transfers, request.transfers)
        ) {
          return fail('Something changed since you opened this.');
        }
        const lines = proposal.transfers.map((t) => ({
          ...t,
          status: 'Not paid' as const,
          paidAt: null,
        }));
        if (lines.length === 0) {
          payOff(proposal.coversUpToId);
        } else {
          const id = Math.max(0, ...data.settlements.map((s) => s.id)) + 1;
          const settlement = { id, createdAt: NOW, coversUpToId: proposal.coversUpToId, lines };
          data = {
            ...data,
            settlements: [...data.settlements, { ...settlement, cancelledAt: null }],
          };
        }
        return ok(data);
      }
      case 'setTransferStatuses': {
        const stale = staleSettlement(request.settlementId, request.seen);
        if (stale) {
          return stale;
        }
        const settlement = data.settlements.find((s) => s.id === request.settlementId);
        if (!settlement) {
          return fail(`Settlement #${request.settlementId} isn't in the sheet anymore.`);
        }
        const updated = withTransferStatuses(settlement, request.statuses, NOW);
        if (!updated.ok) {
          return updated;
        }
        data = {
          ...data,
          settlements: data.settlements.map((s) => (s.id === settlement.id ? updated.value : s)),
        };
        if (settlementState(updated.value) === 'closed') {
          payOff(settlement.coversUpToId);
        }
        return ok(data);
      }
      case 'cancelSettlement': {
        const stale = staleSettlement(request.settlementId, request.seen);
        if (stale) {
          return stale;
        }
        data = {
          ...data,
          settlements: data.settlements.map((s) =>
            s.id === request.settlementId ? { ...s, cancelledAt: NOW } : s,
          ),
        };
        return ok(data);
      }
      case 'addNote': {
        const text = request.text.trim();
        if (text === '') {
          return fail('Write something first.');
        }
        const id = Math.max(0, ...data.notes.map((n) => n.id)) + 1;
        data = { ...data, notes: [...data.notes, { id, createdAt: NOW, text, status: 'Open' }] };
        return ok(data);
      }
      case 'closeNote': {
        data = {
          ...data,
          notes: data.notes.map((n) =>
            n.id === request.noteId && n.status === 'Open' ? { ...n, status: 'Done' } : n,
          ),
        };
        return ok(data);
      }
    }
  }

  function payOff(coversUpToId: number) {
    const paid = paidOffExpenses(data.expenses, coversUpToId);
    data = {
      ...data,
      expenses: data.expenses.map((e) => paid.find((p) => p.id === e.id) ?? e),
    };
  }
}

/** Starts the app already unlocked, as on a phone that entered the passcode before. */
export async function rememberPasscode(page: Page, passcode = PASSCODE): Promise<void> {
  await page.addInitScript((saved) => {
    localStorage.setItem('household-expenses.passcode', saved);
  }, passcode);
}

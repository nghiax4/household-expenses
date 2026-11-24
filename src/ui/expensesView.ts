// How the expense list is shown. Each device remembers its own choice in local storage; if
// storage is unavailable (private browsing, blocked site data), it starts on cards every visit.
export const EXPENSES_VIEWS = ['cards', 'compact', 'table'] as const;
export type ExpensesView = (typeof EXPENSES_VIEWS)[number];

const KEY = 'household-expenses.view';

export function loadExpensesView(): ExpensesView {
  try {
    const saved = localStorage.getItem(KEY);
    return EXPENSES_VIEWS.find((view) => view === saved) ?? 'cards';
  } catch {
    return 'cards';
  }
}

export function saveExpensesView(view: ExpensesView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // Not saved: the choice still applies for this visit.
  }
}

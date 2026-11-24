import type { Expense } from './expense';
import { sum, type Cents } from './money';

/** A month's expenses as the list shows them under one heading. */
export interface MonthGroup {
  /** "YYYY-MM". */
  month: string;
  expenses: Expense[];
  /** What the month's expenses add up to. */
  total: Cents;
}

/**
 * Splits a date-sorted list into months, keeping its order (so newest-first stays newest-first).
 */
export function groupByMonth(expenses: readonly Expense[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const expense of expenses) {
    const month = expense.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) {
      last.expenses.push(expense);
    } else {
      groups.push({ month, expenses: [expense], total: 0 });
    }
  }
  return groups.map((group) => ({ ...group, total: sum(group.expenses.map((e) => e.total)) }));
}

/** How many people on an expense still owe their share (the payer never does). */
export function owingCount(expense: Expense): number {
  return Object.entries(expense.people).filter(
    ([person, cell]) =>
      person !== expense.payer && cell.kind === 'share' && cell.status === 'Not paid',
  ).length;
}

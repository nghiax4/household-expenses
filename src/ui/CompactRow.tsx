import type { Expense } from '../domain/expense';
import { formatDollars } from '../domain/money';
import { owingCount } from '../domain/months';
import type { Template } from '../domain/template';
import { formatDate } from './dates';
import { TagPill } from './TagPill';

interface Props {
  expense: Expense;
  today: string;
  templates: readonly Template[];
  /** Paid off in a closed settlement: nobody owes anything on it anymore. */
  paidOff: boolean;
  onOpen: () => void;
}

/** One expense on a single short row; tapping it opens the full card. */
export function CompactRow({ expense, today, templates, paidOff, onOpen }: Props) {
  const owing = owingCount(expense);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left active:bg-slate-50"
      >
        <span className="w-12 shrink-0 text-sm text-slate-600 tabular-nums">
          {formatDate(expense.date, today)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium">{expense.description}</span>
          {expense.tags.length > 0 && (
            <span className="flex gap-1 overflow-hidden">
              {expense.tags.map((tag) => (
                <TagPill key={tag} tag={tag} templates={templates} />
              ))}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="font-semibold tabular-nums">{formatDollars(expense.total)}</span>
          {owing > 0 ? (
            <span className="text-sm text-red-700">{owing} owe</span>
          ) : (
            <span className="text-sm text-green-700">{paidOff ? '✓ Paid off' : '✓ All paid'}</span>
          )}
        </span>
      </button>
    </li>
  );
}

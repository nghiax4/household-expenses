import type { Expense } from '../domain/expense';
import { formatDollars, type PersonName } from '../domain/money';
import { formatDate } from './dates';
import { ShareChip } from './ShareChip';

interface Props {
  expense: Expense;
  /** The household in person-column order, so chips always appear in the same order. */
  people: readonly PersonName[];
  today: string;
}

export function ExpenseCard({ expense, people, today }: Props) {
  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 font-medium break-words">{expense.description}</h2>
        <p className="shrink-0 font-semibold tabular-nums">{formatDollars(expense.total)}</p>
      </div>
      <p className="text-sm text-slate-600">
        {formatDate(expense.date, today)} · Paid by {expense.payer}
      </p>
      {expense.note !== '' && (
        <p className="mt-1 text-sm break-words text-slate-500">{expense.note}</p>
      )}
      <ul aria-label="Shares" className="mt-2 flex flex-wrap gap-1.5">
        {people.map((person) => {
          const cell = expense.people[person];
          return cell?.kind === 'share' ? (
            <ShareChip key={person} person={person} amount={cell.amount} status={cell.status} />
          ) : null;
        })}
      </ul>
    </li>
  );
}

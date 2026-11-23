import type { Expense } from '../domain/expense';
import { formatDollars, type PersonName } from '../domain/money';
import { formatDate } from './dates';
import { ShareChip } from './ShareChip';

interface Props {
  expense: Expense;
  /** The household in person-column order, so chips always appear in the same order. */
  people: readonly PersonName[];
  today: string;
  /** The pending settlement that covers this expense, if any: it can't change until that's done. */
  lockedBy: number | null;
  onMarkWhoPaid: () => void;
  onEdit: () => void;
}

const CARD_BUTTON =
  'h-9 rounded-full border border-slate-400 px-4 text-sm font-medium active:bg-slate-100';

export function ExpenseCard({ expense, people, today, lockedBy, onMarkWhoPaid, onEdit }: Props) {
  const sharers = people.filter((person) => expense.people[person]?.kind === 'share');
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
        {sharers.map((person) => {
          const cell = expense.people[person];
          return (
            cell?.kind === 'share' && (
              <li key={person}>
                <ShareChip person={person} amount={cell.amount} status={cell.status} />
              </li>
            )
          );
        })}
      </ul>
      {lockedBy !== null ? (
        // Changing it now would change amounts the settlement already worked out.
        <p className="mt-3 text-sm text-slate-600">
          In settlement #{lockedBy}, so it can’t be changed until every transfer is paid (see Settle
          up).
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          {/* Only the payer is in the split: nobody owes anything, so there's nothing to mark. */}
          {sharers.some((person) => person !== expense.payer) && (
            <button type="button" onClick={onMarkWhoPaid} className={CARD_BUTTON}>
              Mark who paid
            </button>
          )}
          <button type="button" onClick={onEdit} className={CARD_BUTTON}>
            Edit
          </button>
        </div>
      )}
    </li>
  );
}

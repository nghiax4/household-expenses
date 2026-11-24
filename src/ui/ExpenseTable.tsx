import type { Expense } from '../domain/expense';
import { formatDollars, type PersonName } from '../domain/money';
import { formatDate } from './dates';

interface Props {
  /** Names the table for screen readers, e.g. "Expenses, November 2026". */
  label: string;
  expenses: readonly Expense[];
  /** The household in person-column order, one column each, like the sheet. */
  people: readonly PersonName[];
  today: string;
  onOpen: (expense: Expense) => void;
}

/**
 * The sheet's layout: a row per expense and a column per person, red while a share is owed and
 * green once paid. On a phone it scrolls sideways; the expense column stays put.
 */
export function ExpenseTable({ label, expenses, people, today, onOpen }: Props) {
  return (
    // `relative` keeps the screen-reader-only text in cells off to the right inside this
    // scrolling box; otherwise it would stretch the whole page sideways.
    <div className="relative overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th scope="col" className="sticky left-0 bg-white px-2 py-1.5 font-medium">
              Expense
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Total
            </th>
            {people.map((person) => (
              <th key={person} scope="col" className="px-2 py-1.5 font-medium whitespace-nowrap">
                {person}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id} className="border-b border-slate-100 last:border-b-0">
              <th scope="row" className="sticky left-0 bg-white p-0 text-left font-normal">
                <button
                  type="button"
                  onClick={() => onOpen(expense)}
                  className="flex w-36 flex-col px-2 py-1.5 text-left active:bg-slate-50"
                >
                  <span className="truncate font-medium">{expense.description}</span>
                  <span className="text-xs text-slate-500">
                    {formatDate(expense.date, today)} · {expense.payer}
                  </span>
                </button>
              </th>
              <td className="px-2 py-1.5 text-right font-medium whitespace-nowrap tabular-nums">
                {formatDollars(expense.total)}
              </td>
              {people.map((person) => (
                <ShareCell key={person} expense={expense} person={person} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShareCell({ expense, person }: { expense: Expense; person: PersonName }) {
  const cell = expense.people[person];
  if (cell?.kind !== 'share') {
    return (
      <td className="px-2 py-1.5 text-center text-slate-300">
        <span aria-hidden="true">–</span>
        <span className="sr-only">not involved</span>
      </td>
    );
  }
  const paid = cell.status === 'Paid';
  return (
    <td
      className={`px-2 py-1.5 whitespace-nowrap tabular-nums ${
        paid ? 'bg-green-100 text-green-900' : 'bg-red-700 text-white'
      }`}
    >
      {/* The check mark keeps paid and owed apart without relying on color. */}
      {paid && <span aria-hidden="true">✓ </span>}
      {formatDollars(cell.amount)}
      <span className="sr-only">, {cell.status.toLowerCase()}</span>
    </td>
  );
}

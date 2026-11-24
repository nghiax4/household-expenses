import { useState } from 'react';
import type { SheetData } from '../api/protocol';
import { liveExpensesNewestFirst, type Expense } from '../domain/expense';
import { matchesSearch } from '../domain/search';
import { coveringSettlement, settlementState } from '../domain/settlement';
import { localDate } from './dates';
import { ExpenseCard } from './ExpenseCard';
import { ExpenseForm } from './ExpenseForm';
import { WhoPaidDialog } from './WhoPaidDialog';

interface Props {
  data: SheetData;
  passcode: string;
  /** Every save returns the sheet read back; this replaces what the app shows. */
  onData: (data: SheetData) => void;
  onPasscodeRejected: () => void;
}

export function ExpensesScreen({ data, passcode, onData, onPasscodeRejected }: Props) {
  // The form, when it's open: for a new expense, or for editing one.
  const [form, setForm] = useState<{ editing?: Expense } | null>(null);
  // The expense whose "Mark who paid" checklist is open.
  const [marking, setMarking] = useState<Expense | null>(null);
  // What's typed in the search box. Kept while the form is open, so the list comes back as it was.
  const [search, setSearch] = useState('');

  if (form) {
    return (
      <ExpenseForm
        data={data}
        editing={form.editing}
        passcode={passcode}
        onSaved={(saved) => {
          onData(saved);
          setForm(null);
        }}
        onCancel={() => setForm(null)}
        onPasscodeRejected={onPasscodeRejected}
      />
    );
  }

  const allExpenses = liveExpensesNewestFirst(data.expenses);
  const expenses = allExpenses.filter((expense) => matchesSearch(expense, search));
  const searching = search.trim() !== '';
  const today = localDate(0);
  return (
    <div className="mt-4 flex flex-col gap-4">
      {data.problems.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950">
          <p className="font-medium">
            Some rows in the Expenses tab can’t be read, so they’re hidden here. Fix them in the
            sheet:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {data.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => setForm({})}
        className="h-12 rounded-lg bg-slate-900 font-medium text-white"
      >
        Add expense
      </button>
      {allExpenses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <input
              type="search"
              aria-label="Search expenses"
              placeholder="Search"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-lg border border-slate-300 pr-12 pl-3 text-base [&::-webkit-search-cancel-button]:hidden"
            />
            {searching && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 w-12 text-xl text-slate-500"
              >
                ✕
              </button>
            )}
          </div>
          {searching && (
            <p aria-live="polite" className="text-sm text-slate-600">
              {expenses.length} of {allExpenses.length} expenses
            </p>
          )}
        </div>
      )}
      {allExpenses.length === 0 ? (
        <p className="text-slate-600">No expenses yet. Tap Add expense to add the first one.</p>
      ) : expenses.length === 0 ? (
        <p className="text-slate-600">No expenses match “{search.trim()}”.</p>
      ) : (
        <ul aria-label="Expenses" className="flex flex-col gap-3">
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              people={data.people}
              today={today}
              templates={data.templates}
              lock={cardLock(data, expense.id)}
              onMarkWhoPaid={() => setMarking(expense)}
              onEdit={() => setForm({ editing: expense })}
            />
          ))}
        </ul>
      )}
      {marking && (
        <WhoPaidDialog
          expense={marking}
          people={data.people}
          passcode={passcode}
          onSaved={(saved) => {
            onData(saved);
            setMarking(null);
          }}
          onCancel={() => setMarking(null)}
          onPasscodeRejected={onPasscodeRejected}
        />
      )}
    </div>
  );
}

function cardLock(data: SheetData, expenseId: number) {
  const settlement = coveringSettlement(data.settlements, expenseId);
  return (
    settlement && {
      settlementId: settlement.id,
      paidOff: settlementState(settlement) === 'closed',
    }
  );
}

import { useState } from 'react';
import type { SheetData } from '../api/protocol';
import { liveExpensesNewestFirst, type Expense } from '../domain/expense';
import { formatDollars } from '../domain/money';
import { groupByMonth, type MonthGroup } from '../domain/months';
import { matchesSearch } from '../domain/search';
import { coveringSettlement, settlementState } from '../domain/settlement';
import { Choice } from './Choice';
import { CompactRow } from './CompactRow';
import { formatMonth, localDate } from './dates';
import { Dialog } from './Dialog';
import { ExpenseCard } from './ExpenseCard';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseTable } from './ExpenseTable';
import { loadExpensesView, saveExpensesView, type ExpensesView } from './expensesView';
import { WhoPaidDialog } from './WhoPaidDialog';

interface Props {
  data: SheetData;
  passcode: string;
  /** Every save returns the sheet read back; this replaces what the app shows. */
  onData: (data: SheetData) => void;
  onPasscodeRejected: () => void;
}

const VIEW_LABELS: Record<ExpensesView, string> = {
  cards: 'Cards',
  compact: 'Compact',
  table: 'Table',
};

export function ExpensesScreen({ data, passcode, onData, onPasscodeRejected }: Props) {
  // The form, when it's open: for a new expense, or for editing one.
  const [form, setForm] = useState<{ editing?: Expense } | null>(null);
  // The expense whose "Mark who paid" checklist is open.
  const [marking, setMarking] = useState<Expense | null>(null);
  // The expense opened from a compact or table row, shown as a full card.
  const [opened, setOpened] = useState<Expense | null>(null);
  // What's typed in the search box. Kept while the form is open, so the list comes back as it was.
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ExpensesView>(loadExpensesView);
  // Months folded away ("YYYY-MM"), to get past old months quickly.
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());

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

  function chooseView(next: ExpensesView) {
    setView(next);
    saveExpensesView(next);
  }

  function toggleMonth(month: string) {
    const next = new Set(folded);
    if (!next.delete(month)) {
      next.add(month);
    }
    setFolded(next);
  }

  function card(expense: Expense, titleId?: string) {
    return (
      <ExpenseCard
        key={expense.id}
        expense={expense}
        people={data.people}
        today={today}
        templates={data.templates}
        lock={cardLock(data, expense.id)}
        titleId={titleId}
        // The card may be open in a dialog; close it first so only one dialog shows.
        onMarkWhoPaid={() => {
          setOpened(null);
          setMarking(expense);
        }}
        onEdit={() => {
          setOpened(null);
          setForm({ editing: expense });
        }}
      />
    );
  }

  function monthBody(group: MonthGroup, label: string) {
    if (view === 'table') {
      return (
        <ExpenseTable
          label={label}
          expenses={group.expenses}
          people={data.people}
          today={today}
          onOpen={setOpened}
        />
      );
    }
    return (
      <ul aria-label={label} className={`flex flex-col ${view === 'compact' ? 'gap-2' : 'gap-3'}`}>
        {group.expenses.map((expense) =>
          view === 'compact' ? (
            <CompactRow
              key={expense.id}
              expense={expense}
              today={today}
              templates={data.templates}
              paidOff={cardLock(data, expense.id)?.paidOff ?? false}
              onOpen={() => setOpened(expense)}
            />
          ) : (
            card(expense)
          ),
        )}
      </ul>
    );
  }

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
        <div className="flex flex-col gap-2">
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
          <div role="group" aria-label="View" className="flex gap-2">
            {(Object.keys(VIEW_LABELS) as ExpensesView[]).map((option) => (
              <Choice key={option} selected={view === option} onClick={() => chooseView(option)}>
                {VIEW_LABELS[option]}
              </Choice>
            ))}
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
        groupByMonth(expenses).map((group) => {
          const month = formatMonth(group.month);
          // While searching, every match shows, so a folded month can't hide one.
          const isFolded = !searching && folded.has(group.month);
          return (
            <section key={group.month} className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={!isFolded}
                disabled={searching}
                onClick={() => toggleMonth(group.month)}
                className="flex items-baseline justify-between gap-3 text-left"
              >
                <span className="font-semibold">
                  {!searching && (
                    <span aria-hidden="true" className="mr-1.5 inline-block w-3 text-slate-500">
                      {isFolded ? '▸' : '▾'}
                    </span>
                  )}
                  {month}
                </span>
                <span className="text-sm text-slate-600 tabular-nums">
                  {group.expenses.length} {group.expenses.length === 1 ? 'expense' : 'expenses'} ·{' '}
                  {formatDollars(group.total)}
                </span>
              </button>
              {!isFolded && monthBody(group, `Expenses, ${month}`)}
            </section>
          );
        })
      )}
      {opened && (
        <Dialog titleId="opened-expense-title">
          <ul>{card(opened, 'opened-expense-title')}</ul>
          <button
            type="button"
            onClick={() => setOpened(null)}
            className="h-12 rounded-lg border border-slate-300 font-medium"
          >
            Close
          </button>
        </Dialog>
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

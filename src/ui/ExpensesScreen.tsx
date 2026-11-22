import { useEffect, useState } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type ExpensesData } from '../api/protocol';
import { liveExpensesNewestFirst, type Expense } from '../domain/expense';
import { AddExpenseForm } from './AddExpenseForm';
import { localDate } from './dates';
import { ExpenseCard } from './ExpenseCard';
import { Waiting } from './Waiting';
import { WhoPaidDialog } from './WhoPaidDialog';

interface Props {
  passcode: string;
  /** The saved passcode no longer works (it was changed), so ask for it again. */
  onPasscodeRejected: () => void;
}

type Loading =
  | { state: 'loading' }
  | { state: 'failed'; error: string }
  | { state: 'ready'; data: ExpensesData };

export function ExpensesScreen({ passcode, onPasscodeRejected }: Props) {
  const [loading, setLoading] = useState<Loading>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  // The expense whose "Mark who paid" checklist is open.
  const [marking, setMarking] = useState<Expense | null>(null);

  useEffect(() => {
    let current = true;
    void callBackend({ passcode, action: 'listExpenses' }).then((result) => {
      if (!current) {
        return;
      }
      if (result.ok) {
        setLoading({ state: 'ready', data: result.value });
      } else if (result.error === WRONG_PASSCODE) {
        onPasscodeRejected();
      } else {
        setLoading({ state: 'failed', error: result.error });
      }
    });
    return () => {
      current = false;
    };
  }, [passcode, attempt, onPasscodeRejected]);

  if (loading.state === 'loading') {
    return (
      <p className="mt-6 text-slate-600">
        <Waiting label="Loading expenses" />
      </p>
    );
  }
  if (loading.state === 'failed') {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p role="alert" className="text-red-700">
          {loading.error}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading({ state: 'loading' });
            setAttempt((n) => n + 1);
          }}
          className="h-12 rounded-lg border border-slate-300 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const { data } = loading;
  if (adding) {
    return (
      <AddExpenseForm
        data={data}
        passcode={passcode}
        onSaved={(saved) => {
          setLoading({ state: 'ready', data: saved });
          setAdding(false);
        }}
        onCancel={() => setAdding(false)}
        onPasscodeRejected={onPasscodeRejected}
      />
    );
  }

  const expenses = liveExpensesNewestFirst(data.expenses);
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
        onClick={() => setAdding(true)}
        className="h-12 rounded-lg bg-slate-900 font-medium text-white"
      >
        Add expense
      </button>
      {expenses.length === 0 ? (
        <p className="text-slate-600">No expenses yet. Tap Add expense to add the first one.</p>
      ) : (
        <ul aria-label="Expenses" className="flex flex-col gap-3">
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              people={data.people}
              today={today}
              onMarkWhoPaid={() => setMarking(expense)}
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
            setLoading({ state: 'ready', data: saved });
            setMarking(null);
          }}
          onCancel={() => setMarking(null)}
          onPasscodeRejected={onPasscodeRejected}
        />
      )}
    </div>
  );
}

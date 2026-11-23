import { useState } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type SheetData } from '../api/protocol';
import type { Expense } from '../domain/expense';
import { paidOffExpenses, type SettlementProposal } from '../domain/settlement';
import { Dialog } from './Dialog';
import { TransferLine } from './TransferLine';
import { Waiting } from './Waiting';

interface Props {
  proposal: SettlementProposal;
  expenses: readonly Expense[];
  passcode: string;
  onSaved: (data: SheetData) => void;
  onCancel: () => void;
  onPasscodeRejected: () => void;
}

/**
 * What "Get total settlement" would create, with nothing saved until Create: a settlement locks
 * the expenses it covers, so a stray tap shouldn't start one.
 */
export function SettlementPreview({
  proposal,
  expenses,
  passcode,
  onSaved,
  onCancel,
  onPasscodeRejected,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { coversUpToId, debts, transfers } = proposal;
  const shares = plural(debts.length, 'unpaid share');
  const expenseCount = plural(paidOffExpenses(expenses, coversUpToId).length, 'expense');

  async function create() {
    setError(null);
    setSaving(true);
    // The backend refuses if these no longer match the sheet, so what's saved is what's shown.
    const result = await callBackend({
      passcode,
      action: 'createSettlement',
      coversUpToId,
      transfers,
    });
    setSaving(false);
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error === WRONG_PASSCODE) {
      onPasscodeRejected();
    } else {
      setError(result.error);
    }
  }

  return (
    <Dialog titleId="preview-title">
      <h2 id="preview-title" className="text-lg font-semibold">
        Settle up?
      </h2>
      {transfers.length === 0 ? (
        <p>
          Nobody needs to send money: the {shares} on {expenseCount} cancel each other out. Mark
          them all paid back?
        </p>
      ) : (
        <>
          <p>
            {transfers.length === 1 ? 'This transfer settles' : 'These transfers settle'} the{' '}
            {shares} on {expenseCount}:
          </p>
          <ul aria-label="Transfers" className="flex flex-col gap-2">
            {transfers.map((transfer) => (
              <li key={`${transfer.from} ${transfer.to}`} className="flex">
                <TransferLine transfer={transfer} status={null} />
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">
            Those expenses are locked until every transfer is marked paid. Expenses added after this
            go into the next settlement.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-12 flex-1 rounded-lg border border-slate-300 font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void create()}
          disabled={saving}
          className="h-12 flex-1 rounded-lg bg-slate-900 font-medium text-white disabled:opacity-50"
        >
          {saving ? (
            <Waiting label="Saving" />
          ) : transfers.length === 0 ? (
            'Mark all paid'
          ) : (
            'Create'
          )}
        </button>
      </div>
    </Dialog>
  );
}

/** "1 expense", "3 expenses". */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

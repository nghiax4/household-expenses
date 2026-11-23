import { useState } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type SheetData } from '../api/protocol';
import type { Expense } from '../domain/expense';
import type { PersonName } from '../domain/money';
import type { ShareStatus } from '../domain/personCell';
import { Dialog } from './Dialog';
import { SaveFailed } from './SaveFailed';
import { ShareChip } from './ShareChip';
import { Waiting } from './Waiting';

interface Props {
  expense: Expense;
  /** The household in person-column order. */
  people: readonly PersonName[];
  passcode: string;
  onSaved: (data: SheetData) => void;
  onCancel: () => void;
  onPasscodeRejected: () => void;
}

/**
 * A checklist of who has paid their share back. Nothing is saved until Save, so a stray tap
 * can be undone by unticking or Cancel.
 */
export function WhoPaidDialog({
  expense,
  people,
  passcode,
  onSaved,
  onCancel,
  onPasscodeRejected,
}: Props) {
  const shares = people.flatMap((person) => {
    const cell = expense.people[person];
    return cell?.kind === 'share' ? [{ person, amount: cell.amount, status: cell.status }] : [];
  });
  const [paid, setPaid] = useState<ReadonlySet<PersonName>>(
    () => new Set(shares.filter((s) => s.status === 'Paid').map((s) => s.person)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(person: PersonName) {
    const next = new Set(paid);
    if (!next.delete(person)) {
      next.add(person);
    }
    setPaid(next);
  }

  async function save() {
    // Only what changed, so another phone's change to someone else isn't overwritten.
    const changes = shares.flatMap(({ person, status }): [PersonName, ShareStatus][] => {
      const now = paid.has(person) ? 'Paid' : 'Not paid';
      return person !== expense.payer && now !== status ? [[person, now]] : [];
    });
    if (changes.length === 0) {
      onCancel();
      return;
    }
    setError(null);
    setSaving(true);
    const result = await callBackend({
      passcode,
      action: 'setShareStatuses',
      expenseId: expense.id,
      seen: expense,
      statuses: Object.fromEntries(changes),
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
    <Dialog titleId="who-paid-title">
      <div>
        <h2 id="who-paid-title" className="text-lg font-semibold">
          Who has paid back for “{expense.description}”?
        </h2>
        <p className="text-sm text-slate-600">Paid by {expense.payer}</p>
      </div>
      <ul className="flex flex-col">
        {shares.map(({ person, amount }) => {
          const isPayer = person === expense.payer;
          const ticked = isPayer || paid.has(person);
          const chip = (
            <ShareChip person={person} amount={amount} status={ticked ? 'Paid' : 'Not paid'} />
          );
          return (
            <li key={person} className="border-t border-slate-100 first:border-t-0">
              {isPayer ? (
                <div className="flex min-h-12 items-center gap-3">
                  {/* Keeps the chips lined up with the rows that have a checkbox. */}
                  <span className="size-6 shrink-0" />
                  {chip}
                  <span className="ml-auto text-sm text-green-700">Paid the bill</span>
                </div>
              ) : (
                <label className="flex min-h-12 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ticked}
                    onChange={() => toggle(person)}
                    disabled={saving}
                    aria-label={`${person} paid back`}
                    className="size-6 shrink-0 accent-green-600"
                  />
                  {chip}
                  <span className={`ml-auto text-sm ${ticked ? 'text-green-700' : 'text-red-700'}`}>
                    {ticked ? 'Paid back' : 'Not paid'}
                  </span>
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <SaveFailed
          error={error}
          passcode={passcode}
          onLatest={onSaved}
          onPasscodeRejected={onPasscodeRejected}
        />
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
          onClick={() => void save()}
          disabled={saving}
          className="h-12 flex-1 rounded-lg bg-slate-900 font-medium text-white disabled:opacity-50"
        >
          {saving ? <Waiting label="Saving" /> : 'Save'}
        </button>
      </div>
    </Dialog>
  );
}

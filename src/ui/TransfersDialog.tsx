import { useState } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type SheetData } from '../api/protocol';
import type { Settlement, SettlementLine, TransferStatus } from '../domain/settlement';
import { Dialog } from './Dialog';
import { SaveFailed } from './SaveFailed';
import { TransferLine } from './TransferLine';
import { Waiting } from './Waiting';

interface Props {
  settlement: Settlement;
  passcode: string;
  onSaved: (data: SheetData) => void;
  onCancel: () => void;
  onPasscodeRejected: () => void;
}

const lineKey = (line: SettlementLine) => `${line.from} → ${line.to}`;

/**
 * A checklist of which transfers have been sent, like "Mark who paid". Nothing is saved until
 * Save; ticking the last one closes the settlement, and the dialog says so before Save.
 */
export function TransfersDialog({
  settlement,
  passcode,
  onSaved,
  onCancel,
  onPasscodeRejected,
}: Props) {
  const { lines } = settlement;
  const [paid, setPaid] = useState<ReadonlySet<string>>(
    () => new Set(lines.filter((line) => line.status === 'Paid').map(lineKey)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const closes = lines.every((line) => paid.has(lineKey(line)));

  function toggle(line: SettlementLine) {
    const next = new Set(paid);
    if (!next.delete(lineKey(line))) {
      next.add(lineKey(line));
    }
    setPaid(next);
  }

  async function save() {
    // Only what changed, so another phone's tick on a different line isn't undone.
    const changes = lines.flatMap((line): TransferStatus[] => {
      const now = paid.has(lineKey(line)) ? 'Paid' : 'Not paid';
      return now === line.status ? [] : [{ from: line.from, to: line.to, status: now }];
    });
    if (changes.length === 0) {
      onCancel();
      return;
    }
    setError(null);
    setSaving(true);
    const result = await callBackend({
      passcode,
      action: 'setTransferStatuses',
      settlementId: settlement.id,
      seen: settlement,
      statuses: changes,
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
    <Dialog titleId="transfers-title">
      <div>
        <h2 id="transfers-title" className="text-lg font-semibold">
          Which transfers have been sent?
        </h2>
        <p className="text-sm text-slate-600">Settlement #{settlement.id}</p>
      </div>
      <ul className="flex flex-col">
        {lines.map((line) => {
          const ticked = paid.has(lineKey(line));
          return (
            <li key={lineKey(line)} className="border-t border-slate-100 first:border-t-0">
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  checked={ticked}
                  onChange={() => toggle(line)}
                  disabled={saving}
                  aria-label={`${line.from} paid ${line.to}`}
                  className="size-6 shrink-0 accent-green-600"
                />
                <TransferLine transfer={line} status={ticked ? 'Paid' : 'Not paid'} />
              </label>
            </li>
          );
        })}
      </ul>
      {closes && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
          Every transfer is ticked, so saving closes the settlement: every share it covers is marked
          paid back. This is final: the settlement and its expenses can’t be changed after that.
        </p>
      )}
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

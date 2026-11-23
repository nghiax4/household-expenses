import { useState } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type SheetData } from '../api/protocol';
import {
  pendingSettlement,
  proposeSettlement,
  settlementState,
  type Settlement,
  type SettlementProposal,
} from '../domain/settlement';
import { formatDate, localDate } from './dates';
import { SettlementPreview } from './SettlementPreview';
import { TransferLine } from './TransferLine';
import { TransfersDialog } from './TransfersDialog';
import { Waiting } from './Waiting';

interface Props {
  data: SheetData;
  passcode: string;
  onData: (data: SheetData) => void;
  onPasscodeRejected: () => void;
}

const CARD_BUTTON =
  'h-9 rounded-full border border-slate-400 px-4 text-sm font-medium active:bg-slate-100 disabled:opacity-50';

/** "Get total settlement", the settlement being paid, and past ones. */
export function SettleScreen({ data, passcode, onData, onPasscodeRejected }: Props) {
  const [preview, setPreview] = useState<SettlementProposal | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);
  const today = localDate(0);
  const pending = pendingSettlement(data.settlements);
  const past = data.settlements.filter((s) => s !== pending).reverse();

  async function getTotal() {
    setNotice(null);
    setAdding(true);
    // Fresh from the sheet, so the preview includes what other phones saved since this one loaded.
    const result = await callBackend({ passcode, action: 'listExpenses' });
    setAdding(false);
    if (!result.ok) {
      if (result.error === WRONG_PASSCODE) {
        onPasscodeRejected();
      } else {
        setNotice({ text: result.error, isError: true });
      }
      return;
    }
    const fresh = result.value;
    onData(fresh);
    if (pendingSettlement(fresh.settlements)) {
      return; // Another phone started one; it now shows here.
    }
    if (fresh.problems.length > 0) {
      setNotice({
        text:
          'Some rows in the Expenses tab can’t be read (the Expenses screen lists them), so a ' +
          'settlement could miss what they owe. Fix them in the sheet first.',
        isError: true,
      });
      return;
    }
    const proposal = proposeSettlement(fresh.expenses, fresh.people);
    if (proposal) {
      setPreview(proposal);
    } else {
      setNotice({ text: 'Nothing to settle: every share has been paid back.', isError: false });
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Settle up</h2>
      {pending ? (
        <PendingSettlement
          settlement={pending}
          today={today}
          passcode={passcode}
          onData={onData}
          onPasscodeRejected={onPasscodeRejected}
        />
      ) : (
        <section className="flex flex-col gap-3">
          <p className="text-slate-600">
            Adds up every share that hasn’t been paid back and works out the fewest transfers that
            settle everyone.
          </p>
          <button
            type="button"
            onClick={() => void getTotal()}
            disabled={adding}
            className="h-12 rounded-lg bg-slate-900 font-medium text-white disabled:opacity-50"
          >
            {adding ? <Waiting label="Adding up" /> : 'Get total settlement'}
          </button>
          {notice && (
            <p
              role={notice.isError ? 'alert' : 'status'}
              className={notice.isError ? 'text-red-700' : 'text-slate-600'}
            >
              {notice.text}
            </p>
          )}
        </section>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">Past settlements</h3>
          <ul aria-label="Past settlements" className="flex flex-col gap-3">
            {past.map((settlement) => (
              <PastSettlement key={settlement.id} settlement={settlement} today={today} />
            ))}
          </ul>
        </section>
      )}

      {preview && (
        <SettlementPreview
          proposal={preview}
          expenses={data.expenses}
          passcode={passcode}
          onSaved={(saved) => {
            onData(saved);
            setPreview(null);
            // Nothing new appears on this screen in that case, so say what happened.
            if (preview.transfers.length === 0) {
              setNotice({ text: 'Done: those shares are all marked paid back.', isError: false });
            }
          }}
          onCancel={() => setPreview(null)}
          onPasscodeRejected={onPasscodeRejected}
        />
      )}
    </div>
  );
}

interface PendingProps {
  settlement: Settlement;
  today: string;
  passcode: string;
  onData: (data: SheetData) => void;
  onPasscodeRejected: () => void;
}

/** The settlement being paid: its transfers, ticking them off, and cancelling it. */
function PendingSettlement({
  settlement,
  today,
  passcode,
  onData,
  onPasscodeRejected,
}: PendingProps) {
  const [marking, setMarking] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anyPaid = settlement.lines.some((line) => line.status === 'Paid');

  async function cancel() {
    setError(null);
    setCancelling(true);
    const result = await callBackend({
      passcode,
      action: 'cancelSettlement',
      settlementId: settlement.id,
    });
    setCancelling(false);
    if (result.ok) {
      onData(result.value);
    } else if (result.error === WRONG_PASSCODE) {
      onPasscodeRejected();
    } else {
      setError(result.error);
    }
  }

  return (
    <section
      aria-labelledby="pending-title"
      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3"
    >
      <div>
        <h3 id="pending-title" className="font-medium">
          Settlement #{settlement.id}
        </h3>
        <p className="text-sm text-slate-600">
          Started {formatDate(settlement.createdAt.slice(0, 10), today)}. The expenses added before
          then are locked until every transfer is marked paid.
        </p>
      </div>
      <TransferList settlement={settlement} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMarking(true)} className={CARD_BUTTON}>
          Mark transfers paid
        </button>
        {/* Once money has moved, cancelling would hide it, so the button goes away. */}
        {!anyPaid && !confirmingCancel && (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="h-9 rounded-full px-4 text-sm font-medium text-red-700"
          >
            Cancel settlement
          </button>
        )}
      </div>
      {!anyPaid && confirmingCancel && (
        <div
          role="group"
          aria-label="Cancel this settlement?"
          className="flex flex-col gap-3 rounded-lg border border-red-200 p-3"
        >
          <p>
            Cancel settlement #{settlement.id}? Its transfers are dropped, and the expenses it
            covers can be changed again. It stays in the history as cancelled.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              disabled={cancelling}
              className="h-12 flex-1 rounded-lg border border-slate-300 font-medium disabled:opacity-50"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              className="h-12 flex-1 rounded-lg bg-red-700 font-medium text-white disabled:opacity-50"
            >
              {cancelling ? <Waiting label="Cancelling" /> : 'Cancel it'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {marking && (
        <TransfersDialog
          settlement={settlement}
          passcode={passcode}
          onSaved={(saved) => {
            onData(saved);
            setMarking(false);
          }}
          onCancel={() => setMarking(false)}
          onPasscodeRejected={onPasscodeRejected}
        />
      )}
    </section>
  );
}

/** A closed or cancelled settlement, kept as history. */
function PastSettlement({ settlement, today }: { settlement: Settlement; today: string }) {
  const cancelled = settlementState(settlement) === 'cancelled';
  // When the last transfer was ticked, which is when it closed.
  const closedAt = settlement.lines
    .map((line) => line.paidAt ?? '')
    .sort()
    .at(-1);
  const when = cancelled ? settlement.cancelledAt : closedAt;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-medium">Settlement #{settlement.id}</h4>
        <p className="text-sm text-slate-600">
          {cancelled ? 'Cancelled' : 'Paid off'}
          {when ? ` ${formatDate(when.slice(0, 10), today)}` : ''}
        </p>
      </div>
      <TransferList settlement={settlement} />
    </li>
  );
}

function TransferList({ settlement }: { settlement: Settlement }) {
  const cancelled = settlementState(settlement) === 'cancelled';
  return (
    <ul aria-label={`Transfers of settlement #${settlement.id}`} className="flex flex-col gap-2">
      {settlement.lines.map((line) => (
        <li key={`${line.from} ${line.to}`} className="flex">
          {/* A cancelled settlement's transfers were never owed, so they get no status color. */}
          <TransferLine transfer={line} status={cancelled ? null : line.status} />
        </li>
      ))}
    </ul>
  );
}

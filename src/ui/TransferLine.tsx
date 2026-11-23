import { formatDollars } from '../domain/money';
import type { ShareStatus } from '../domain/personCell';
import type { Transfer } from '../domain/settlement';

interface Props {
  transfer: Transfer;
  /** Red while Not paid, green once Paid (like share chips); gray when it doesn't apply. */
  status: ShareStatus | null;
}

/** One transfer of a settlement: "Chi → Anh" and the amount. */
export function TransferLine({ transfer, status }: Props) {
  const colors =
    status === 'Paid'
      ? 'bg-green-100 text-green-900'
      : status === 'Not paid'
        ? 'bg-red-700 text-white'
        : 'bg-slate-100 text-slate-700';
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 break-words">
        {transfer.from} <span aria-hidden="true">→</span>
        <span className="sr-only">pays</span> {transfer.to}
      </span>
      <span
        className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-sm tabular-nums ${colors}`}
      >
        {status === 'Paid' && <span aria-hidden="true">✓ </span>}
        {formatDollars(transfer.amount)}
        {status && <span className="sr-only">, {status.toLowerCase()}</span>}
      </span>
    </span>
  );
}

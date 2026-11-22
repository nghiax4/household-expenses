import { formatDollars, type Cents, type PersonName } from '../domain/money';
import type { ShareStatus } from '../domain/personCell';

interface Props {
  person: PersonName;
  amount: Cents;
  status: ShareStatus;
}

/** One person's share: red while Not paid, green once Paid (the same colors as the sheet). */
export function ShareChip({ person, amount, status }: Props) {
  const paid = status === 'Paid';
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-sm ${
        paid ? 'bg-green-100 text-green-900' : 'bg-red-700 text-white'
      }`}
    >
      {/* The check mark keeps the two apart without relying on color. */}
      {paid && <span aria-hidden="true">✓ </span>}
      {person} {formatDollars(amount)}
      <span className="sr-only">, {status.toLowerCase()}</span>
    </span>
  );
}

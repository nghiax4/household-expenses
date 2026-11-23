// Reading and writing rows of the Settlements tab: one row per transfer, and the rows of one
// settlement share its ID. Pure, so the rules are unit-tested without Google services.
import type { Expense } from '../../src/domain/expense';
import { formatDollars, parseDollars, type PersonName } from '../../src/domain/money';
import type { ShareStatus } from '../../src/domain/personCell';
import { fail, ok, type Result } from '../../src/domain/result';
import {
  settlementState,
  type Settlement,
  type SettlementLine,
  type Transfer,
} from '../../src/domain/settlement';
import { dollarsCell, literal, type SheetCell } from './cells';
import { TAB_HEADERS } from './schema';

const HEADERS: readonly string[] = TAB_HEADERS.Settlements;

/** Sheet columns (A = 1) that change after a settlement is created. */
export const SETTLEMENT_COLUMNS = {
  paid: HEADERS.indexOf('Paid') + 1,
  paidAt: HEADERS.indexOf('Paid at') + 1,
  cancelledAt: HEADERS.indexOf('Cancelled at') + 1,
};

/**
 * Reads the Settlements tab from its displayed cells, header row first. Unlike Expenses, one bad
 * row fails the whole tab: settlements decide which expenses are locked, so a guess could let a
 * phone change amounts a settlement already used. Only Claude edits this tab by hand.
 */
export function readSettlementsTab(
  rows: readonly (readonly string[])[],
  people: readonly PersonName[],
): Result<Settlement[]> {
  const [header = [], ...dataRows] = rows;
  if (!HEADERS.every((name, i) => header[i] === name)) {
    return fail(`The Settlements tab's header row must be: ${HEADERS.join(', ')}.`);
  }

  const settlements = new Map<number, Settlement>();
  for (const [index, row] of dataRows.entries()) {
    if (row.every((cell) => cell === '')) {
      continue;
    }
    const added = addRow(settlements, row, people);
    if (!added.ok) {
      return fail(`Settlements row ${index + 2}: ${added.error} Fix it in the sheet.`);
    }
  }

  const sorted = [...settlements.values()].sort((a, b) => a.id - b.id);
  const pending = sorted.filter((settlement) => settlementState(settlement) === 'pending');
  if (pending.length > 1) {
    return fail(
      `Settlements ${pending.map((s) => `#${s.id}`).join(' and ')} are still open, but ` +
        'only one can be open at a time. Fix the Settlements tab in the sheet.',
    );
  }
  return ok(sorted);
}

/** The columns every row of one settlement repeats, which must agree. */
const FIELD_HEADERS = {
  createdAt: 'Created at',
  coversUpToId: 'Covers up to expense #',
  cancelledAt: 'Cancelled at',
} as const;

/** Reads one row into the settlement it belongs to, checking it agrees with its other rows. */
function addRow(
  settlements: Map<number, Settlement>,
  row: readonly string[],
  people: readonly PersonName[],
): Result<null> {
  const [
    idText = '',
    createdAt = '',
    coversText = '',
    from = '',
    to = '',
    amountText = '',
    status = '',
    paidAt = '',
    cancelledAt = '',
  ] = row;
  if (!/^[1-9]\d*$/.test(idText)) {
    return fail(`the Settlement ID "${idText}" isn't a whole number above 0.`);
  }
  if (createdAt === '') {
    return fail('"Created at" is empty.');
  }
  if (!/^[1-9]\d*$/.test(coversText)) {
    return fail(`"Covers up to expense #" is "${coversText}", not a whole number above 0.`);
  }
  for (const name of [from, to]) {
    if (!people.includes(name)) {
      return fail(`"${name}" doesn't match any person column in Expenses.`);
    }
  }
  if (from === to) {
    return fail(`${from} can't pay themself.`);
  }
  const amount = parseDollars(amountText);
  if (amount === null || amount === 0) {
    return fail(`the amount "${amountText}" isn't an amount like $12.34 above $0.00.`);
  }
  if (!isShareStatus(status)) {
    return fail(`Paid is "${status}", but must be "Paid" or "Not paid".`);
  }

  const id = Number(idText);
  const line: SettlementLine = { from, to, amount, status, paidAt: paidAt === '' ? null : paidAt };
  const fields = {
    createdAt,
    coversUpToId: Number(coversText),
    cancelledAt: cancelledAt === '' ? null : cancelledAt,
  };
  const existing = settlements.get(id);
  if (!existing) {
    settlements.set(id, { id, ...fields, lines: [line] });
    return ok(null);
  }
  const differs = (Object.keys(fields) as (keyof typeof fields)[]).find(
    (key) => existing[key] !== fields[key],
  );
  if (differs) {
    return fail(`settlement #${id}'s "${FIELD_HEADERS[differs]}" doesn't match its other rows.`);
  }
  if (existing.lines.some((l) => l.from === from && l.to === to)) {
    return fail(`settlement #${id} already has a transfer from ${from} to ${to}.`);
  }
  existing.lines.push(line);
  return ok(null);
}

function isShareStatus(text: string): text is ShareStatus {
  return text === 'Paid' || text === 'Not paid';
}

/** The ID for the next settlement: one more than the highest on any row. */
export function nextSettlementId(rows: readonly (readonly string[])[]): number {
  const ids = rows
    .slice(1)
    .map((row) => row[0] ?? '')
    .filter((cell) => /^[1-9]\d*$/.test(cell))
    .map(Number);
  return Math.max(0, ...ids) + 1;
}

/** The rows to append for a new settlement, one per transfer. */
export function settlementRows(settlement: Settlement): SheetCell[][] {
  return settlement.lines.map((line) => [
    { value: settlement.id },
    literal(settlement.createdAt),
    { value: settlement.coversUpToId },
    literal(line.from),
    literal(line.to),
    dollarsCell(line.amount),
    literal(line.status),
    literal(line.paidAt ?? ''),
    literal(settlement.cancelledAt ?? ''),
  ]);
}

/**
 * The sheet row (the header is row 1) of a settlement's transfer. Reading the tab already
 * refused duplicates, so a missing row means the tab changed underneath this request.
 */
export function settlementLineRow(
  rows: readonly (readonly string[])[],
  settlementId: number,
  { from, to }: Transfer,
): number {
  const index = rows.findIndex(
    (row, i) => i > 0 && row[0] === String(settlementId) && row[3] === from && row[4] === to,
  );
  if (index === -1) {
    throw new Error(`settlement #${settlementId}'s transfer from ${from} to ${to} disappeared.`);
  }
  return index + 1;
}

/** `Chi → Anh $10.00; Dương → Anh $5.00` */
function transfersText(transfers: readonly Transfer[]): string {
  return transfers.map((t) => `${t.from} → ${t.to} ${formatDollars(t.amount)}`).join('; ');
}

/** `#2 "Internet": Chi $10.00, Dương $10.00; #3 "Groceries": Bảo $15.00`, in person-column order. */
function unpaidSharesText(expenses: readonly Expense[], people: readonly PersonName[]): string {
  return expenses
    .map((expense) => {
      const unpaid = people.flatMap((person) => {
        const cell = expense.people[person];
        return cell?.kind === 'share' && cell.status === 'Not paid'
          ? [`${person} ${formatDollars(cell.amount)}`]
          : [];
      });
      return `#${expense.id} "${expense.description}": ${unpaid.join(', ')}`;
    })
    .join('; ');
}

export function createdSettlementActivity(time: string, settlement: Settlement): SheetCell[] {
  const details =
    `#${settlement.id}, covering expenses up to #${settlement.coversUpToId}: ` +
    `${transfersText(settlement.lines)}.`;
  return [literal(time), literal('Created settlement'), literal(details)];
}

export function transferStatusActivity(
  time: string,
  settlementId: number,
  line: Transfer,
  status: ShareStatus,
): SheetCell[] {
  const before: ShareStatus = status === 'Paid' ? 'Not paid' : 'Paid';
  const details = `Settlement #${settlementId}: ${transfersText([line])}, ${before} → ${status}.`;
  return [
    literal(time),
    literal(status === 'Paid' ? 'Marked transfer paid' : 'Marked transfer not paid'),
    literal(details),
  ];
}

export function cancelledSettlementActivity(time: string, settlement: Settlement): SheetCell[] {
  const details =
    `#${settlement.id} (covering expenses up to #${settlement.coversUpToId}): ` +
    `${transfersText(settlement.lines)}.`;
  return [literal(time), literal('Cancelled settlement'), literal(details)];
}

/**
 * The Activity entry for closing a settlement, listing every share it marked Paid (`paidOff` as
 * they were before), so the change can be traced or undone by hand.
 */
export function closedSettlementActivity(
  time: string,
  settlement: Settlement,
  paidOff: readonly Expense[],
  people: readonly PersonName[],
): SheetCell[] {
  const details =
    `#${settlement.id}: every transfer is paid, so these shares were marked Paid: ` +
    `${unpaidSharesText(paidOff, people)}.`;
  return [literal(time), literal('Closed settlement'), literal(details)];
}

/** The Activity entry for unpaid shares that cancelled out, so no settlement was needed. */
export function settledWithoutTransfersActivity(
  time: string,
  coversUpToId: number,
  paidOff: readonly Expense[],
  people: readonly PersonName[],
): SheetCell[] {
  const details =
    `Expenses up to #${coversUpToId}: the unpaid shares cancelled out, so nobody had to send ` +
    `money. Marked Paid: ${unpaidSharesText(paidOff, people)}.`;
  return [literal(time), literal('Settled without transfers'), literal(details)];
}

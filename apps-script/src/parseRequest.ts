// Checks the shape of a request body. Business rules (who exists, sums, locks) are checked later,
// by the handler.
import type { ApiRequest } from '../../src/api/protocol';
import type { NewExpense } from '../../src/domain/expense';
import type { ShareStatus } from '../../src/domain/personCell';
import type { Transfer, TransferStatus } from '../../src/domain/settlement';

/** The request, or null if it's malformed. */
export function parseRequest(rawBody: string): ApiRequest | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isRecord(body) || typeof body.passcode !== 'string') {
    return null;
  }

  const { passcode, action } = body;
  switch (action) {
    case 'checkPasscode':
    case 'listExpenses':
      return { passcode, action };
    case 'addExpense': {
      const expense = parseNewExpense(body.expense);
      return expense && { passcode, action, expense };
    }
    case 'editExpense': {
      const { expenseId } = body;
      const expense = parseNewExpense(body.expense);
      return isId(expenseId) && expense ? { passcode, action, expenseId, expense } : null;
    }
    case 'deleteExpense': {
      const { expenseId } = body;
      return isId(expenseId) ? { passcode, action, expenseId } : null;
    }
    case 'setShareStatuses': {
      const { expenseId, statuses } = body;
      if (!isId(expenseId) || !isRecord(statuses)) {
        return null;
      }
      const entries = Object.entries(statuses);
      if (!entries.every((entry): entry is [string, ShareStatus] => isShareStatus(entry[1]))) {
        return null;
      }
      return { passcode, action, expenseId, statuses: Object.fromEntries(entries) };
    }
    case 'createSettlement': {
      const { coversUpToId, transfers } = body;
      return isId(coversUpToId) && Array.isArray(transfers) && transfers.every(isTransfer)
        ? { passcode, action, coversUpToId, transfers }
        : null;
    }
    case 'setTransferStatuses': {
      const { settlementId, statuses } = body;
      return isId(settlementId) && Array.isArray(statuses) && statuses.every(isTransferStatus)
        ? { passcode, action, settlementId, statuses }
        : null;
    }
    case 'cancelSettlement': {
      const { settlementId } = body;
      return isId(settlementId) ? { passcode, action, settlementId } : null;
    }
    default:
      return null;
  }
}

function parseNewExpense(value: unknown): NewExpense | null {
  if (!isRecord(value)) {
    return null;
  }
  const { date, description, total, payer, note, shares } = value;
  if (
    typeof date !== 'string' ||
    typeof description !== 'string' ||
    typeof total !== 'number' ||
    typeof payer !== 'string' ||
    typeof note !== 'string' ||
    !isRecord(shares)
  ) {
    return null;
  }
  const amounts = Object.entries(shares);
  if (!amounts.every((entry): entry is [string, number] => typeof entry[1] === 'number')) {
    return null;
  }
  return { date, description, total, payer, note, shares: Object.fromEntries(amounts) };
}

function isTransfer(value: unknown): value is Transfer {
  return (
    isRecord(value) &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    typeof value.amount === 'number' &&
    Number.isSafeInteger(value.amount)
  );
}

function isTransferStatus(value: unknown): value is TransferStatus {
  return (
    isRecord(value) &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    isShareStatus(value.status)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShareStatus(value: unknown): value is ShareStatus {
  return value === 'Paid' || value === 'Not paid';
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

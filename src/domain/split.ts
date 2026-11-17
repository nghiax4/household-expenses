import { formatDollars, sum, type Cents, type PersonName } from './money';
import { fail, ok, type Result } from './result';

/** Each participant's share of an expense, in person-column order. */
export type Shares = ReadonlyMap<PersonName, Cents>;

/** A percentage in hundredths of a percent, so it stays an integer: 12.5% is 1250. */
export type BasisPoints = number;
const ONE_HUNDRED_PERCENT: BasisPoints = 10_000;

/**
 * Splits a total equally. Cents that don't divide evenly go to the payer
 * ($139.61 / 4 → payer $34.91, others $34.90). If the payer isn't taking part,
 * they go one cent each to participants in person-column order.
 */
export function splitEqually(
  total: Cents,
  participants: readonly PersonName[],
  payer: PersonName,
): Result<Shares> {
  if (participants.length === 0) {
    return fail('Pick at least one person to split with.');
  }
  if (total < participants.length) {
    return fail(`${formatDollars(total)} is too small to split between ${participants.length}.`);
  }
  const base = Math.floor(total / participants.length);
  const shares = new Map(participants.map((person) => [person, base]));
  return ok(giveLeftoverCents(shares, total - base * participants.length, payer));
}

/**
 * Turns percentages into amounts (percentages are only an input method; amounts are stored).
 * Rounding follows the same rule as an equal split.
 */
export function splitByPercentages(
  total: Cents,
  percentages: ReadonlyMap<PersonName, BasisPoints>,
  payer: PersonName,
): Result<Shares> {
  if (percentages.size === 0) {
    return fail('Pick at least one person to split with.');
  }
  const percentSum = sum(percentages.values());
  if (percentSum !== ONE_HUNDRED_PERCENT) {
    return fail(`The percentages add up to ${percentSum / 100}%, not 100%.`);
  }
  if ([...percentages.values()].some((value) => value <= 0)) {
    return fail('Every percentage must be more than 0%. Untick people who aren’t involved.');
  }

  const shares = new Map(
    [...percentages].map(([person, value]) => [
      person,
      Math.floor((total * value) / ONE_HUNDRED_PERCENT),
    ]),
  );
  const leftover = total - sum(shares.values());
  // A tiny percentage of a small total can round down to $0.00, which checkCustomSplit rejects.
  return checkCustomSplit(total, giveLeftoverCents(shares, leftover, payer));
}

/** Checks hand-typed amounts: each must be more than $0.00, and they must add up to the total. */
export function checkCustomSplit(total: Cents, shares: Shares): Result<Shares> {
  if (shares.size === 0) {
    return fail('Pick at least one person to split with.');
  }
  for (const [person, amount] of shares) {
    if (amount <= 0) {
      return fail(`${person}'s share must be more than $0.00.`);
    }
  }
  const sharesSum = sum(shares.values());
  if (sharesSum !== total) {
    return fail(
      `The shares add up to ${formatDollars(sharesSum)}, but the total is ${formatDollars(total)}.`,
    );
  }
  return ok(shares);
}

/**
 * True if these shares are exactly what an equal split would give. The split type isn't
 * stored, so the edit form uses this to decide whether to show "equal" or custom amounts.
 */
export function isEqualSplit(total: Cents, shares: Shares, payer: PersonName): boolean {
  const equal = splitEqually(total, [...shares.keys()], payer);
  return equal.ok && [...shares].every(([person, amount]) => equal.value.get(person) === amount);
}

function giveLeftoverCents(shares: Shares, leftover: Cents, payer: PersonName): Shares {
  const result = new Map(shares);
  const payerShare = result.get(payer);
  if (payerShare !== undefined) {
    result.set(payer, payerShare + leftover);
    return result;
  }
  // The payer isn't taking part. The leftover is always smaller than the number of
  // participants, because each share lost less than one cent to rounding down.
  for (const person of [...result.keys()].slice(0, leftover)) {
    result.set(person, (result.get(person) ?? 0) + 1);
  }
  return result;
}

import type { ReactNode } from 'react';
import {
  formatDollars,
  formatTypedAmount,
  parseTypedAmount,
  sum,
  type Cents,
  type PersonName,
} from '../domain/money';
import { fail, type Result } from '../domain/result';
import {
  formatPercent,
  ONE_HUNDRED_PERCENT,
  parseTypedPercent,
  sharesFromTyped,
  splitEqually,
  type SplitMode,
  type TypedSplit,
} from '../domain/split';
import { Choice } from './Choice';
import { ShareChip } from './ShareChip';

interface Props {
  /** The household in person-column order. */
  people: readonly PersonName[];
  /** The total typed so far, or null while it isn't a valid amount. */
  total: Cents | null;
  payer: PersonName | null;
  participants: ReadonlySet<PersonName>;
  onToggleParticipant: (person: PersonName) => void;
  typed: TypedSplit;
  onTypedChange: (typed: TypedSplit) => void;
}

const MODES: readonly { mode: SplitMode; label: string }[] = [
  { mode: 'equal', label: 'Equally' },
  { mode: 'amounts', label: 'Amounts' },
  { mode: 'percent', label: 'Percent' },
];

/** Who shares an expense and how: equally, by typed amounts, or by typed percentages. */
export function SplitPicker({
  people,
  total,
  payer,
  participants,
  onToggleParticipant,
  typed,
  onTypedChange,
}: Props) {
  // Person-column order, whatever order they were tapped in.
  const chosen = people.filter((person) => participants.has(person));
  const shares: Result<ReadonlyMap<PersonName, Cents>> =
    total === null || payer === null
      ? fail('Not enough to split yet.')
      : sharesFromTyped(total, chosen, payer, typed);

  /** Switching to boxes starts them at the equal split, so only the differences need typing. */
  function switchMode(mode: SplitMode) {
    // A payer who isn't picked yet (or isn't taking part) only decides who gets leftover cents.
    const tiebreak = payer ?? '';
    const amounts = total === null ? null : splitEqually(total, chosen, tiebreak);
    const percents = splitEqually(ONE_HUNDRED_PERCENT, chosen, tiebreak);
    onTypedChange({
      mode,
      amounts:
        mode === 'amounts' && amounts?.ok
          ? Object.fromEntries(
              [...amounts.value].map(([p, cents]) => [p, formatTypedAmount(cents)]),
            )
          : typed.amounts,
      percents:
        mode === 'percent' && percents.ok
          ? Object.fromEntries([...percents.value].map(([p, value]) => [p, formatPercent(value)]))
          : typed.percents,
    });
  }

  function setBox(person: PersonName, text: string) {
    const key = typed.mode === 'amounts' ? 'amounts' : 'percents';
    onTypedChange({ ...typed, [key]: { ...typed[key], [person]: text } });
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-medium">Split</legend>
      <div
        role="group"
        aria-label="How to split"
        className="mb-3 flex rounded-full border border-slate-300 p-1"
      >
        {MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={typed.mode === mode}
            onClick={() => switchMode(mode)}
            className={`h-9 flex-1 rounded-full text-sm font-medium ${
              typed.mode === mode ? 'bg-slate-900 text-white' : ''
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Split between" className="flex flex-wrap gap-2">
        {people.map((person) => (
          <Choice
            key={person}
            selected={participants.has(person)}
            onClick={() => onToggleParticipant(person)}
          >
            {person}
          </Choice>
        ))}
      </div>

      {typed.mode !== 'equal' && chosen.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {chosen.map((person) => (
            <label key={person} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 break-words">{person}</span>
              <BoxWithUnit unit={typed.mode === 'amounts' ? '$' : '%'}>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={`${person}'s ${typed.mode === 'amounts' ? 'amount' : 'percentage'}`}
                  value={(typed.mode === 'amounts' ? typed.amounts : typed.percents)[person] ?? ''}
                  onChange={(event) => setBox(person, event.target.value)}
                  // Left-aligned on purpose: the empty space is then after the number, so a tap
                  // there puts the cursor at the end (the iPhone keypad has no arrow keys).
                  className={`h-11 w-32 rounded-lg border border-slate-300 text-base ${
                    typed.mode === 'amounts' ? 'pr-3 pl-7' : 'pr-8 pl-3'
                  }`}
                />
              </BoxWithUnit>
            </label>
          ))}
          <Remainder typed={typed} chosen={chosen} total={total} />
        </div>
      )}

      {/* With typed amounts the boxes already show each share; otherwise preview them. */}
      {typed.mode !== 'amounts' && shares.ok && (
        <ul aria-label="Each person’s share" className="mt-3 flex flex-wrap gap-1.5">
          {chosen.map((person) => (
            <li key={person}>
              <ShareChip
                person={person}
                amount={shares.value.get(person) ?? 0}
                status={person === payer ? 'Paid' : 'Not paid'}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Allowed on purpose (paying for others), but easy to do by a missed tap, so say what
          it means. */}
      {total !== null && payer !== null && chosen.length > 0 && !participants.has(payer) && (
        <p className="mt-2 text-sm text-slate-600">
          {payer} isn’t in the split, so {payer} is owed the full {formatDollars(total)}.
        </p>
      )}
    </fieldset>
  );
}

/** How far the typed boxes are from adding up: "$2.00 left to split", "✓ Adds up to 100%". */
function Remainder({
  typed,
  chosen,
  total,
}: {
  typed: TypedSplit;
  chosen: readonly PersonName[];
  total: Cents | null;
}) {
  const isAmounts = typed.mode === 'amounts';
  const target = isAmounts ? total : ONE_HUNDRED_PERCENT;
  if (target === null) {
    return null;
  }
  // Boxes that aren't numbers yet count as 0 here; Save explains exactly what's wrong.
  const typedSum = sum(
    chosen.map((person) => {
      const value = isAmounts
        ? parseTypedAmount(typed.amounts[person] ?? '')
        : parseTypedPercent(typed.percents[person] ?? '');
      return value.ok ? value.value : 0;
    }),
  );
  const format = (value: number) => (isAmounts ? formatDollars(value) : `${formatPercent(value)}%`);
  const difference = target - typedSum;
  if (difference === 0) {
    return <p className="text-sm text-green-700">✓ Adds up to {format(target)}</p>;
  }
  return (
    <p className="text-sm text-amber-700">
      {difference > 0 ? `${format(difference)} left to split` : `${format(-difference)} too much`}
    </p>
  );
}

function BoxWithUnit({ unit, children }: { unit: '$' | '%'; children: ReactNode }) {
  return (
    <span className="relative shrink-0">
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-2.5 text-slate-500 ${
          unit === '$' ? 'left-3' : 'right-3'
        }`}
      >
        {unit}
      </span>
    </span>
  );
}

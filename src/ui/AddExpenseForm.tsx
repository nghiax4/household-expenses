import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type ExpensesData } from '../api/protocol';
import { buildExpense, recentDescriptions, type NewExpense } from '../domain/expense';
import { formatDollars, parseTypedAmount, sum, type Cents, type PersonName } from '../domain/money';
import { fail, ok, type Result } from '../domain/result';
import { splitEqually } from '../domain/split';
import { localDate } from './dates';
import { ShareChip } from './ShareChip';
import { Waiting } from './Waiting';

interface Props {
  data: ExpensesData;
  passcode: string;
  onSaved: (data: ExpensesData) => void;
  onCancel: () => void;
  onPasscodeRejected: () => void;
}

const RECENT_DESCRIPTION_COUNT = 6;
const TEXT_BOX = 'h-12 w-full rounded-lg border border-slate-300 px-3 text-base';

export function AddExpenseForm({ data, passcode, onSaved, onCancel, onPasscodeRejected }: Props) {
  const { people } = data;
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(() => localDate(0));
  const [payer, setPayer] = useState<PersonName | null>(null);
  const [participants, setParticipants] = useState<ReadonlySet<PersonName>>(new Set());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The list may have been scrolled far down; the form starts at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const today = localDate(0);
  const yesterday = localDate(1);
  // Person-column order, whatever order they were tapped in.
  const chosen = people.filter((person) => participants.has(person));
  const preview = previewShares(amountText, chosen, payer);
  const recent = recentDescriptions(data.expenses, RECENT_DESCRIPTION_COUNT);

  function toggleParticipant(person: PersonName) {
    const next = new Set(participants);
    if (!next.delete(person)) {
      next.add(person);
    }
    setParticipants(next);
  }

  function prepare(): Result<NewExpense> {
    if (description.trim() === '') {
      return fail('Add a description.');
    }
    const total = parseTypedAmount(amountText);
    if (!total.ok) {
      return fail(total.error);
    }
    if (payer === null) {
      return fail('Pick who paid.');
    }
    const shares = splitEqually(total.value, chosen, payer);
    if (!shares.ok) {
      return fail(shares.error);
    }
    const expense = {
      date,
      description,
      total: total.value,
      payer,
      note,
      shares: Object.fromEntries(shares.value),
    };
    // The backend checks again, but explaining a problem here saves a slow round trip.
    const checked = buildExpense(expense, 0, people);
    return checked.ok ? ok(expense) : fail(checked.error);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const expense = prepare();
    if (!expense.ok) {
      setError(expense.error);
      return;
    }
    setError(null);
    setSaving(true);
    const result = await callBackend({ passcode, action: 'addExpense', expense: expense.value });
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
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-5">
      <h2 className="text-xl font-semibold">Add expense</h2>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="font-medium">
          Description
        </label>
        <input
          id="description"
          type="text"
          autoComplete="off"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={TEXT_BOX}
        />
        {/* Common expenses need no typing: tap a recent description to fill it in. */}
        {recent.length > 0 && (
          <div aria-label="Recent descriptions" role="group" className="flex flex-wrap gap-2">
            {recent.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => setDescription(text)}
                className="rounded-2xl bg-slate-100 px-3 py-1 text-left text-sm active:bg-slate-300"
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="amount" className="font-medium">
          Total
        </label>
        <div className="relative">
          <span aria-hidden="true" className="absolute top-3 left-3 text-slate-500">
            $
          </span>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            className={`${TEXT_BOX} pl-7`}
          />
        </div>
      </div>

      {/* min-w-0: a fieldset is otherwise at least as wide as its contents, and the iPhone's
          date box would push the page wider than the screen. */}
      <fieldset className="min-w-0">
        <legend className="mb-2 font-medium">Date</legend>
        <div className="flex gap-2">
          <Choice selected={date === today} onClick={() => setDate(today)}>
            Today
          </Choice>
          <Choice selected={date === yesterday} onClick={() => setDate(yesterday)}>
            Yesterday
          </Choice>
          {/* The iPhone's own date picker, for anything older. */}
          <input
            type="date"
            aria-label="Pick a date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-full border border-slate-300 px-3 text-base"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-medium">Paid by</legend>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <Choice key={person} selected={payer === person} onClick={() => setPayer(person)}>
              {person}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-medium">Split equally between</legend>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <Choice
              key={person}
              selected={participants.has(person)}
              onClick={() => toggleParticipant(person)}
            >
              {person}
            </Choice>
          ))}
        </div>
        {preview && (
          <ul aria-label="Each person’s share" className="mt-3 flex flex-wrap gap-1.5">
            {chosen.map((person) => (
              <li key={person}>
                <ShareChip
                  person={person}
                  amount={preview.get(person) ?? 0}
                  status={person === payer ? 'Paid' : 'Not paid'}
                />
              </li>
            ))}
          </ul>
        )}
        {/* Allowed on purpose (paying for others), but easy to do by a missed tap, so say what
            it means. */}
        {preview && payer !== null && !participants.has(payer) && (
          <p className="mt-2 text-sm text-slate-600">
            {payer} isn’t in the split, so {payer} is owed the full{' '}
            {formatDollars(sum(preview.values()))}.
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="note" className="font-medium">
          Note <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input
          id="note"
          type="text"
          autoComplete="off"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={TEXT_BOX}
        />
      </div>

      {/* Always takes up its line, so the buttons never shift when an error appears. */}
      <p role="alert" className="min-h-5 text-sm text-red-700">
        {error}
      </p>
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
          type="submit"
          disabled={saving}
          className="h-12 flex-1 rounded-lg bg-slate-900 font-medium text-white disabled:opacity-50"
        >
          {saving ? <Waiting label="Saving" /> : 'Save'}
        </button>
      </div>
    </form>
  );
}

/** The equal split as it would be saved, or null until there's enough to show one. */
function previewShares(
  amountText: string,
  participants: readonly PersonName[],
  payer: PersonName | null,
): ReadonlyMap<PersonName, Cents> | null {
  const total = parseTypedAmount(amountText);
  if (!total.ok || payer === null || participants.length === 0) {
    return null;
  }
  const shares = splitEqually(total.value, participants, payer);
  return shares.ok ? shares.value : null;
}

interface ChoiceProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** A pill that's dark when picked. Used for one-of-many and many-of-many choices alike. */
function Choice({ selected, onClick, children }: ChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-10 rounded-full border px-4 ${
        selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'
      }`}
    >
      {children}
    </button>
  );
}

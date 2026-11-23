import { useEffect, useState, type FormEvent } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type SheetData } from '../api/protocol';
import { buildExpense, recentDescriptions, type Expense, type NewExpense } from '../domain/expense';
import { formatTypedAmount, parseTypedAmount, type PersonName } from '../domain/money';
import { fail, ok, type Result } from '../domain/result';
import { isEqualSplit, sharesFromTyped, type TypedSplit } from '../domain/split';
import type { Template } from '../domain/template';
import { localDate } from './dates';
import { Choice } from './Choice';
import { SaveFailed } from './SaveFailed';
import { SplitPicker } from './SplitPicker';
import { Waiting } from './Waiting';

interface Props {
  data: SheetData;
  /** The expense to edit. Without it, the form adds a new one. */
  editing?: Expense;
  passcode: string;
  onSaved: (data: SheetData) => void;
  onCancel: () => void;
  onPasscodeRejected: () => void;
}

const RECENT_DESCRIPTION_COUNT = 6;
const TEXT_BOX = 'h-12 w-full rounded-lg border border-slate-300 px-3 text-base';
const EQUAL_SPLIT: TypedSplit = { mode: 'equal', amounts: {}, percents: {} };

/** Adds an expense, or edits (and deletes) one. */
export function ExpenseForm({
  data,
  editing,
  passcode,
  onSaved,
  onCancel,
  onPasscodeRejected,
}: Props) {
  const { people } = data;
  const [initial] = useState(() => initialValues(editing, people));
  const [description, setDescription] = useState(initial.description);
  const [amountText, setAmountText] = useState(initial.amountText);
  const [date, setDate] = useState(initial.date);
  const [payer, setPayer] = useState(initial.payer);
  const [participants, setParticipants] = useState(initial.participants);
  const [typed, setTyped] = useState(initial.typed);
  const [note, setNote] = useState(initial.note);
  // A problem with what's typed, found before sending.
  const [error, setError] = useState<string | null>(null);
  // Why the backend (or the network) refused the save.
  const [saveError, setSaveError] = useState<string | null>(null);
  // Which request is running, so only its button shows the spinner.
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The list may have been scrolled far down; the form starts at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const today = localDate(0);
  const yesterday = localDate(1);
  // Person-column order, whatever order they were tapped in.
  const chosen = people.filter((person) => participants.has(person));
  const total = parseTypedAmount(amountText);
  const recent = recentDescriptions(data.expenses, RECENT_DESCRIPTION_COUNT);

  function toggleParticipant(person: PersonName) {
    const next = new Set(participants);
    if (!next.delete(person)) {
      next.add(person);
    }
    setParticipants(next);
  }

  /** Fills the form from a template. Everything stays editable before saving. */
  function fillFrom(template: Template) {
    setDescription(template.name);
    setPayer(template.payer);
    setParticipants(new Set(template.participants));
    setTyped(EQUAL_SPLIT);
    setAmountText(template.defaultAmount === null ? '' : formatTypedAmount(template.defaultAmount));
    setError(null);
  }

  function prepare(): Result<NewExpense> {
    if (description.trim() === '') {
      return fail('Add a description.');
    }
    if (!total.ok) {
      return fail(total.error);
    }
    if (payer === null) {
      return fail('Pick who paid.');
    }
    const shares = sharesFromTyped(total.value, chosen, payer, typed);
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
    setSaveError(null);
    setBusy('saving');
    finish(
      editing
        ? await callBackend({
            passcode,
            action: 'editExpense',
            expenseId: editing.id,
            seen: editing,
            expense: expense.value,
          })
        : await callBackend({ passcode, action: 'addExpense', expense: expense.value }),
    );
  }

  async function handleDelete(expense: Expense) {
    setError(null);
    setSaveError(null);
    setBusy('deleting');
    finish(
      await callBackend({
        passcode,
        action: 'deleteExpense',
        expenseId: expense.id,
        seen: expense,
      }),
    );
  }

  function finish(result: Result<SheetData>) {
    setBusy(null);
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error === WRONG_PASSCODE) {
      onPasscodeRejected();
    } else {
      setSaveError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-5">
      <h2 className="text-xl font-semibold">{editing ? 'Edit expense' : 'Add expense'}</h2>

      {/* Quick fill would overwrite an expense being edited, so it's for new ones only. */}
      {!editing && data.templates.length > 0 && (
        <div className="flex flex-col gap-2">
          <p id="quick-fill" className="font-medium">
            Quick fill
          </p>
          <div role="group" aria-labelledby="quick-fill" className="flex flex-wrap gap-2">
            {data.templates.map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => fillFrom(template)}
                className="h-10 rounded-full bg-slate-100 px-4 active:bg-slate-300"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Templates are typed by hand in the sheet, so say which rows were skipped and why. */}
      {!editing && data.templateProblems.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950">
          <p className="font-medium">
            Some templates in the sheet can’t be read, so they’re left out. Fix them in the
            Templates tab:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {data.templateProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

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

      <SplitPicker
        people={people}
        total={total.ok ? total.value : null}
        payer={payer}
        participants={participants}
        onToggleParticipant={toggleParticipant}
        typed={typed}
        onTypedChange={setTyped}
      />

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

      {saveError ? (
        <SaveFailed
          error={saveError}
          passcode={passcode}
          onLatest={onSaved}
          onPasscodeRejected={onPasscodeRejected}
        />
      ) : (
        // Always takes up its line, so the buttons never shift when an error appears.
        <p role="alert" className="min-h-5 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy !== null}
          className="h-12 flex-1 rounded-lg border border-slate-300 font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy !== null}
          className="h-12 flex-1 rounded-lg bg-slate-900 font-medium text-white disabled:opacity-50"
        >
          {busy === 'saving' ? <Waiting label="Saving" /> : 'Save'}
        </button>
      </div>

      {editing &&
        (confirmingDelete ? (
          <div
            role="group"
            aria-label="Delete this expense?"
            className="flex flex-col gap-3 rounded-lg border border-red-200 p-3"
          >
            <p>
              Delete “{editing.description}”? It disappears from the app for everyone, and the app
              can’t bring it back.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy !== null}
                className="h-12 flex-1 rounded-lg border border-slate-300 font-medium disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(editing)}
                disabled={busy !== null}
                className="h-12 flex-1 rounded-lg bg-red-700 font-medium text-white disabled:opacity-50"
              >
                {busy === 'deleting' ? <Waiting label="Deleting" /> : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy !== null}
            className="h-12 rounded-lg font-medium text-red-700 disabled:opacity-50"
          >
            Delete expense
          </button>
        ))}
    </form>
  );
}

interface FormValues {
  description: string;
  amountText: string;
  date: string;
  payer: PersonName | null;
  participants: ReadonlySet<PersonName>;
  typed: TypedSplit;
  note: string;
}

/**
 * What the form starts with: empty for a new expense (nothing pre-picked, so a wrong default
 * can't slip through), or the expense as stored. Its split shows as "equal" when the amounts
 * are exactly an equal split, otherwise as typed amounts (the split type isn't stored).
 */
function initialValues(editing: Expense | undefined, people: readonly PersonName[]): FormValues {
  if (!editing) {
    return {
      description: '',
      amountText: '',
      date: localDate(0),
      payer: null,
      participants: new Set(),
      typed: EQUAL_SPLIT,
      note: '',
    };
  }
  const shares = new Map(
    people.flatMap((person): [PersonName, number][] => {
      const cell = editing.people[person];
      return cell?.kind === 'share' ? [[person, cell.amount]] : [];
    }),
  );
  const amounts = Object.fromEntries(
    [...shares].map(([person, cents]) => [person, formatTypedAmount(cents)]),
  );
  return {
    description: editing.description,
    amountText: formatTypedAmount(editing.total),
    date: editing.date,
    payer: editing.payer,
    participants: new Set(shares.keys()),
    typed: isEqualSplit(editing.total, shares, editing.payer)
      ? EQUAL_SPLIT
      : { mode: 'amounts', amounts, percents: {} },
    note: editing.note,
  };
}

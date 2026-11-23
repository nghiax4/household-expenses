import { useState, type FormEvent } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type SheetData } from '../api/protocol';
import { openNotesNewestFirst, type Note } from '../domain/note';
import { formatDate, localDate } from './dates';
import { SaveFailed } from './SaveFailed';
import { Waiting } from './Waiting';

interface Props {
  data: SheetData;
  passcode: string;
  onData: (data: SheetData) => void;
  onPasscodeRejected: () => void;
}

/**
 * Cases the app didn't handle, jotted down on the spot to talk through with Claude later. Claude
 * reads the open ones at the start of each session; "Done" clears one once it's been dealt with.
 */
export function NotesScreen({ data, passcode, onData, onPasscodeRejected }: Props) {
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notes = openNotesNewestFirst(data.notes);
  const today = localDate(0);

  async function add(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAdding(true);
    const result = await callBackend({ passcode, action: 'addNote', text });
    setAdding(false);
    if (result.ok) {
      onData(result.value);
      setText('');
    } else if (result.error === WRONG_PASSCODE) {
      onPasscodeRejected();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Notes</h2>
      <form onSubmit={(event) => void add(event)} className="flex flex-col gap-3">
        <label htmlFor="note-text" className="text-slate-600">
          Something came up that the app can’t handle? Jot it down, and bring it to Claude later.
        </label>
        <textarea
          id="note-text"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={adding}
          className="w-full rounded-lg border border-slate-300 p-3 text-base"
        />
        {error && (
          <SaveFailed
            error={error}
            passcode={passcode}
            onLatest={(latest) => {
              setError(null);
              onData(latest);
            }}
            onPasscodeRejected={onPasscodeRejected}
          />
        )}
        <button
          type="submit"
          disabled={adding || text.trim() === ''}
          className="h-12 rounded-lg bg-slate-900 font-medium text-white disabled:opacity-50"
        >
          {adding ? <Waiting label="Adding" /> : 'Add note'}
        </button>
      </form>

      {data.noteProblems.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950">
          <p className="font-medium">
            Some rows in the Ideas tab can’t be read, so they’re hidden here. Fix them in the sheet:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {data.noteProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-slate-600">No open notes.</p>
      ) : (
        <ul aria-label="Open notes" className="flex flex-col gap-3">
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              today={today}
              passcode={passcode}
              onData={onData}
              onPasscodeRejected={onPasscodeRejected}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface NoteItemProps {
  note: Note;
  today: string;
  passcode: string;
  onData: (data: SheetData) => void;
  onPasscodeRejected: () => void;
}

function NoteItem({ note, today, passcode, onData, onPasscodeRejected }: NoteItemProps) {
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setError(null);
    setClosing(true);
    const result = await callBackend({ passcode, action: 'closeNote', noteId: note.id });
    setClosing(false);
    if (result.ok) {
      onData(result.value);
    } else if (result.error === WRONG_PASSCODE) {
      onPasscodeRejected();
    } else {
      setError(result.error);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
      <p className="text-sm text-slate-600">{formatDate(note.createdAt.slice(0, 10), today)}</p>
      {/* Kept as typed, line breaks included. */}
      <p className="break-words whitespace-pre-wrap">{note.text}</p>
      <button
        type="button"
        onClick={() => void close()}
        disabled={closing}
        aria-label={`Mark note from ${formatDate(note.createdAt.slice(0, 10), today)} done`}
        className="h-9 self-end rounded-full border border-slate-400 px-4 text-sm font-medium active:bg-slate-100 disabled:opacity-50"
      >
        {closing ? <Waiting label="Saving" /> : 'Done'}
      </button>
      {error && (
        <SaveFailed
          error={error}
          passcode={passcode}
          onLatest={onData}
          onPasscodeRejected={onPasscodeRejected}
        />
      )}
    </li>
  );
}

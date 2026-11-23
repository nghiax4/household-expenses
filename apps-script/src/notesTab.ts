// Reading and writing the notes in the Ideas tab. Pure, so the rules are unit-tested without
// Google services.
import { NOTE_STATUSES, type Note, type NoteStatus } from '../../src/domain/note';
import { fail, ok, type Result } from '../../src/domain/result';
import { literal, type SheetCell } from './cells';
import { TAB_HEADERS } from './schema';

/** Sheet columns (A = 1) the app writes after a row exists. */
export const NOTE_COLUMNS = { status: 4 } as const;

/**
 * Reads the Ideas tab from its displayed cells, header row first. Never fails as a whole: notes
 * don't touch money, so a broken row (or header) is reported and skipped while the rest of the
 * app keeps working.
 */
export function readNotesTab(rows: readonly (readonly string[])[]): {
  notes: Note[];
  problems: string[];
} {
  const [header = [], ...dataRows] = rows;
  const expected: readonly string[] = TAB_HEADERS.Ideas;
  if (!expected.every((name, i) => header[i] === name)) {
    return { notes: [], problems: [`The Ideas tab's header row must be: ${expected.join(', ')}.`] };
  }

  const notes: Note[] = [];
  const problems: string[] = [];
  dataRows.forEach((row, index) => {
    if (row.every((cell) => cell.trim() === '')) {
      return;
    }
    const note = readNoteRow(row);
    if (!note.ok) {
      problems.push(`Ideas row ${index + 2}: ${note.error}`);
    } else if (notes.some((n) => n.id === note.value.id)) {
      problems.push(`Ideas row ${index + 2}: ID ${note.value.id} is already used above.`);
    } else {
      notes.push(note.value);
    }
  });
  return { notes, problems };
}

function readNoteRow(row: readonly string[]): Result<Note> {
  const [idText = '', createdAt = '', text = '', status = ''] = row;
  if (!/^[1-9]\d*$/.test(idText)) {
    return fail(`the ID "${idText}" isn't a whole number.`);
  }
  if (text.trim() === '') {
    return fail('the note is empty.');
  }
  if (!isNoteStatus(status)) {
    return fail(`the status "${status}" must be ${NOTE_STATUSES.join(', ')}.`);
  }
  return ok({ id: Number(idText), createdAt, text, status });
}

function isNoteStatus(value: string): value is NoteStatus {
  return (NOTE_STATUSES as readonly string[]).includes(value);
}

/** One more than the highest ID on any row, so IDs are never reused. */
export function nextNoteId(rows: readonly (readonly string[])[]): number {
  const ids = rows
    .slice(1)
    .map((row) => row[0] ?? '')
    .filter((cell) => /^[1-9]\d*$/.test(cell))
    .map(Number);
  return Math.max(0, ...ids) + 1;
}

/** The cells to append for a new note, in column order (Outcome starts empty). */
export function noteRow(note: Note): SheetCell[] {
  return [
    { value: note.id },
    literal(note.createdAt),
    literal(note.text),
    literal(note.status),
    literal(''),
  ];
}

/** Which sheet row (1 = header) holds the note. */
export function noteRowNumber(rows: readonly (readonly string[])[], id: number): Result<number> {
  const matches = rows.flatMap((row, index) =>
    index > 0 && row[0] === String(id) ? [index + 1] : [],
  );
  const [rowNumber] = matches;
  if (rowNumber === undefined) {
    return fail(`Note #${id} isn't in the sheet anymore.`);
  }
  if (matches.length > 1) {
    return fail(
      `Note #${id} is on rows ${matches.join(' and ')} of the Ideas tab. Fix that first.`,
    );
  }
  return ok(rowNumber);
}

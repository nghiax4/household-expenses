import { describe, expect, it } from 'vitest';
import { nextNoteId, noteRowNumber, readNotesTab } from './notesTab';
import { TAB_HEADERS } from './schema';

const HEADER = [...TAB_HEADERS.Ideas];

describe('readNotesTab', () => {
  it('reads every note, keeping line breaks, and skips blank rows', () => {
    const rows = [
      HEADER,
      ['1', '2026-11-20 09:00', 'Paid the electricity in cash', 'Done', 'Added a note field'],
      ['', '', '', '', ''],
      ['2', '2026-11-23 14:05', 'Rent split 5 ways\nfor one month', 'Open', ''],
    ];
    expect(readNotesTab(rows)).toEqual({
      notes: [
        {
          id: 1,
          createdAt: '2026-11-20 09:00',
          text: 'Paid the electricity in cash',
          status: 'Done',
        },
        {
          id: 2,
          createdAt: '2026-11-23 14:05',
          text: 'Rent split 5 ways\nfor one month',
          status: 'Open',
        },
      ],
      problems: [],
    });
  });

  it('reports and skips rows it can’t read, keeping the rest', () => {
    const rows = [
      HEADER,
      ['x', '2026-11-20 09:00', 'Bad ID', 'Open'],
      ['2', '2026-11-20 09:00', '  ', 'Open'],
      ['3', '2026-11-20 09:00', 'Odd status', 'open'],
      ['4', '2026-11-20 09:00', 'Fine', 'Open'],
      ['4', '2026-11-20 09:00', 'Same ID', 'Open'],
    ];
    const { notes, problems } = readNotesTab(rows);
    expect(notes.map((note) => note.text)).toEqual(['Fine']);
    expect(problems).toEqual([
      'Ideas row 2: the ID "x" isn\'t a whole number.',
      'Ideas row 3: the note is empty.',
      'Ideas row 4: the status "open" must be Open, Done, Dropped.',
      'Ideas row 6: ID 4 is already used above.',
    ]);
  });

  it('reports a changed header instead of guessing what the columns mean', () => {
    expect(readNotesTab([['ID', 'When', 'Note', 'Status', 'Outcome']])).toEqual({
      notes: [],
      problems: ["The Ideas tab's header row must be: ID, Created at, Note, Status, Outcome."],
    });
  });
});

describe('note IDs and rows', () => {
  const rows = [HEADER, ['1', '', 'a', 'Open'], ['oops', '', 'b', 'Open'], ['4', '', 'c', 'Done']];

  it('gives the next note one more than the highest ID', () => {
    expect(nextNoteId(rows)).toBe(5);
    expect(nextNoteId([HEADER])).toBe(1);
  });

  it('finds a note’s row, and refuses one that’s missing or on two rows', () => {
    expect(noteRowNumber(rows, 4)).toEqual({ ok: true, value: 4 });
    expect(noteRowNumber(rows, 9)).toEqual({
      ok: false,
      error: "Note #9 isn't in the sheet anymore.",
    });
    expect(noteRowNumber([...rows, ['4', '', 'd', 'Open']], 4)).toEqual({
      ok: false,
      error: 'Note #4 is on rows 4 and 5 of the Ideas tab. Fix that first.',
    });
  });
});

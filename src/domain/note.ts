/**
 * Open: still to talk through with Claude. Done: dealt with. Dropped: decided against (set in the
 * sheet; the app only lists Open notes).
 */
export const NOTE_STATUSES = ['Open', 'Done', 'Dropped'] as const;

export type NoteStatus = (typeof NOTE_STATUSES)[number];

/**
 * Something that came up that the app didn't handle, jotted down to bring to Claude later. One row
 * of the sheet's Ideas tab.
 */
export interface Note {
  id: number;
  /** When it was added, e.g. "2026-11-23 14:05". */
  createdAt: string;
  text: string;
  status: NoteStatus;
}

/** Open notes, newest first: what the Notes screen lists. */
export function openNotesNewestFirst(notes: readonly Note[]): Note[] {
  return notes.filter((note) => note.status === 'Open').sort((a, b) => b.id - a.id);
}

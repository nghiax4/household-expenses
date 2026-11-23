import { describe, expect, it } from 'vitest';
import { openNotesNewestFirst, type Note } from './note';

const note = (id: number, status: Note['status']): Note => ({
  id,
  createdAt: '2026-11-23 10:00',
  text: `Note ${id}`,
  status,
});

describe('openNotesNewestFirst', () => {
  it('keeps only open notes, newest first', () => {
    const notes = [note(1, 'Open'), note(2, 'Done'), note(3, 'Open'), note(4, 'Dropped')];
    expect(openNotesNewestFirst(notes).map((n) => n.id)).toEqual([3, 1]);
  });
});

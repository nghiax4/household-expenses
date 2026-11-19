import { describe, expect, it } from 'vitest';
import { FIRST_PERSON_COLUMN, parsePeopleSetting, PERSON_CELL_RULES } from './schema';

describe('parsePeopleSetting', () => {
  it('splits, trims and keeps column order', () => {
    expect(parsePeopleSetting(' Anh, Bảo ,Chi ')).toEqual({
      ok: true,
      value: ['Anh', 'Bảo', 'Chi'],
    });
  });

  it('ignores empty entries such as a trailing comma', () => {
    expect(parsePeopleSetting('Anh,,Bảo,')).toEqual({ ok: true, value: ['Anh', 'Bảo'] });
  });

  it('rejects a missing or empty setting', () => {
    expect(parsePeopleSetting(null).ok).toBe(false);
    expect(parsePeopleSetting(' , ').ok).toBe(false);
  });

  it('rejects duplicate names', () => {
    expect(parsePeopleSetting('Anh, Bảo, Anh')).toEqual({
      ok: false,
      error: '"Anh" is listed twice in PEOPLE. Names must be unique.',
    });
  });
});

describe('sheet layout', () => {
  it('starts people at column H, matching the formulas', () => {
    expect(FIRST_PERSON_COLUMN).toBe(8);
    expect(PERSON_CELL_RULES.valid).toContain('H2');
  });

  it('writes the validation formula exactly as tested in the sample sheet', () => {
    expect(PERSON_CELL_RULES.valid).toBe(
      '=IF(OR($A2="", H$1=""), H2="", OR(EXACT(H2, "Not involved"), ' +
        'REGEXMATCH(H2, "^\\$[0-9,]+\\.[0-9]{2} · (Paid|Not paid)$")))',
    );
  });
});

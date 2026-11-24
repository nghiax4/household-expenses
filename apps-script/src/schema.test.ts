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
  it('starts people at column I (after Tags), matching the formulas', () => {
    expect(FIRST_PERSON_COLUMN).toBe(9);
    expect(PERSON_CELL_RULES.valid).toContain('I2');
  });

  it('writes the validation formula as tested in the sample sheet, moved to column I', () => {
    expect(PERSON_CELL_RULES.valid).toBe(
      '=IF(OR($A2="", I$1=""), I2="", OR(EXACT(I2, "Not involved"), ' +
        'REGEXMATCH(I2, "^\\$[0-9,]+\\.[0-9]{2} · (Paid|Not paid)$")))',
    );
  });
});

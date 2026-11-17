import { describe, expect, it } from 'vitest';
import { sum } from './money';
import {
  checkCustomSplit,
  isEqualSplit,
  splitByPercentages,
  splitEqually,
  type Shares,
} from './split';

// Made-up people (the repo is public). Diacritics on purpose: real names have them.
const ROOMMATES = ['Anh', 'Bảo', 'Chi', 'Dương'];

function sharesOf(result: ReturnType<typeof splitEqually>): Shares {
  if (!result.ok) {
    throw new Error(`Expected a split, got: ${result.error}`);
  }
  return result.value;
}

describe('splitEqually', () => {
  it('gives the leftover cent to the payer ($123.45 split 4 ways)', () => {
    const shares = sharesOf(splitEqually(12345, ROOMMATES, 'Bảo'));
    expect([...shares]).toEqual([
      ['Anh', 3086],
      ['Bảo', 3087],
      ['Chi', 3086],
      ['Dương', 3086],
    ]);
  });

  it('gives several leftover cents to the payer ($20.03 split 5 ways)', () => {
    const shares = sharesOf(splitEqually(2003, [...ROOMMATES, 'Em'], 'Anh'));
    expect(shares.get('Anh')).toBe(403);
    expect(shares.get('Em')).toBe(400);
  });

  it('spreads leftover cents in column order when the payer is not taking part', () => {
    const shares = sharesOf(splitEqually(1002, ['Chi', 'Dương', 'Em', 'Giang'], 'Bảo'));
    expect([...shares]).toEqual([
      ['Chi', 251],
      ['Dương', 251],
      ['Em', 250],
      ['Giang', 250],
    ]);
  });

  it('handles one participant and exact divisions', () => {
    expect([...sharesOf(splitEqually(4000, ['Anh'], 'Bảo'))]).toEqual([['Anh', 4000]]);
    expect(new Set(sharesOf(splitEqually(234568, ROOMMATES, 'Bảo')).values())).toEqual(
      new Set([58642]),
    );
  });

  it('always adds up exactly to the total, with only the payer paying extra', () => {
    for (let total = 4; total <= 2000; total++) {
      const withPayer = sharesOf(splitEqually(total, ROOMMATES, 'Bảo'));
      expect(sum(withPayer.values())).toBe(total);
      const others = ROOMMATES.filter((person) => person !== 'Bảo').map((p) => withPayer.get(p));
      expect(new Set(others).size).toBe(1);

      // Em isn't taking part, so the leftover is spread a cent at a time.
      const withoutPayer = sharesOf(splitEqually(total, ROOMMATES, 'Em'));
      expect(sum(withoutPayer.values())).toBe(total);
      const amounts = [...withoutPayer.values()];
      expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
    }
  });

  it('rejects an empty split and totals smaller than one cent each', () => {
    expect(splitEqually(1000, [], 'Bảo').ok).toBe(false);
    expect(splitEqually(3, ROOMMATES, 'Bảo').ok).toBe(false);
    expect(splitEqually(4, ROOMMATES, 'Bảo').ok).toBe(true);
  });
});

describe('splitByPercentages', () => {
  it('converts percentages to amounts, payer absorbing rounding', () => {
    const percentages = new Map([
      ['Anh', 3333],
      ['Bảo', 3333],
      ['Chi', 3334],
    ]);
    const shares = sharesOf(splitByPercentages(10000, percentages, 'Bảo'));
    expect([...shares]).toEqual([
      ['Anh', 3333],
      ['Bảo', 3333],
      ['Chi', 3334],
    ]);
    const rounded = sharesOf(splitByPercentages(1001, percentages, 'Bảo'));
    expect(sum(rounded.values())).toBe(1001);
    // Each rounds down to 333; the 2 leftover cents go to the payer.
    expect([...rounded]).toEqual([
      ['Anh', 333],
      ['Bảo', 335],
      ['Chi', 333],
    ]);
  });

  it('rejects percentages that do not add up to 100%', () => {
    const result = splitByPercentages(
      1000,
      new Map([
        ['Anh', 5000],
        ['Bảo', 4000],
      ]),
      'Bảo',
    );
    expect(result).toEqual({ ok: false, error: 'The percentages add up to 90%, not 100%.' });
  });

  it('rejects 0% and shares that round down to $0.00', () => {
    expect(
      splitByPercentages(
        1000,
        new Map([
          ['Anh', 10000],
          ['Bảo', 0],
        ]),
        'Bảo',
      ).ok,
    ).toBe(false);
    // 1% of $0.50 is half a cent, which rounds down to $0.00.
    expect(
      splitByPercentages(
        50,
        new Map([
          ['Anh', 9900],
          ['Chi', 100],
        ]),
        'Anh',
      ).ok,
    ).toBe(false);
  });
});

describe('checkCustomSplit', () => {
  it('accepts amounts that add up to the total', () => {
    const shares = new Map([
      ['Bảo', 1750],
      ['Chi', 2000],
      ['Dương', 2500],
    ]);
    expect(checkCustomSplit(6250, shares)).toEqual({ ok: true, value: shares });
  });

  it('explains a mismatch in dollars', () => {
    expect(checkCustomSplit(6250, new Map([['Bảo', 6000]]))).toEqual({
      ok: false,
      error: 'The shares add up to $60.00, but the total is $62.50.',
    });
  });

  it('rejects zero shares and an empty split', () => {
    expect(
      checkCustomSplit(
        1000,
        new Map([
          ['Bảo', 1000],
          ['Chi', 0],
        ]),
      ).ok,
    ).toBe(false);
    expect(checkCustomSplit(0, new Map()).ok).toBe(false);
  });
});

describe('isEqualSplit', () => {
  it('recognises an equal split, including where the payer absorbed cents', () => {
    expect(isEqualSplit(12345, sharesOf(splitEqually(12345, ROOMMATES, 'Bảo')), 'Bảo')).toBe(true);
  });

  it('treats anything else as custom', () => {
    const custom = new Map([
      ['Bảo', 1750],
      ['Chi', 2000],
      ['Dương', 2500],
    ]);
    expect(isEqualSplit(6250, custom, 'Chi')).toBe(false);
    // Equal amounts, but the leftover cent went to the wrong person.
    const wrongCent = new Map([
      ['Anh', 3087],
      ['Bảo', 3086],
      ['Chi', 3086],
      ['Dương', 3086],
    ]);
    expect(isEqualSplit(12345, wrongCent, 'Bảo')).toBe(false);
  });
});

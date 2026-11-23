import { describe, expect, it } from 'vitest';
import { sameData } from './sameData';

describe('sameData', () => {
  it('compares nested objects by value, in any key order', () => {
    const seen = { id: 1, people: { Anh: { kind: 'share', amount: 500, status: 'Paid' } } };
    const now = { people: { Anh: { status: 'Paid', amount: 500, kind: 'share' } }, id: 1 };
    expect(sameData(seen, now)).toBe(true);
    expect(sameData(seen, { ...now, people: { Anh: { ...now.people.Anh, amount: 600 } } })).toBe(
      false,
    );
  });

  it('treats a missing key like one set to undefined, but not like null', () => {
    expect(sameData({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(sameData({ a: 1 }, { a: 1, b: null })).toBe(false);
    expect(sameData({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('compares arrays item by item, in order', () => {
    expect(sameData([1, { x: 'a' }], [1, { x: 'a' }])).toBe(true);
    expect(sameData([1, 2], [2, 1])).toBe(false);
    expect(sameData([1], [1, 2])).toBe(false);
    expect(sameData([], {})).toBe(false);
  });

  it('compares plain values exactly', () => {
    expect(sameData('Paid', 'Paid')).toBe(true);
    expect(sameData(1, '1')).toBe(false);
    expect(sameData(null, undefined)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { applyNumberPadKey, type NumberFormat, type NumberPadKey } from './numberEntry';

function press(keys: NumberPadKey[], format: NumberFormat, start = ''): string {
  return keys.reduce((text, key) => applyNumberPadKey(text, key, format), start);
}

describe('digits (passcode)', () => {
  const passcode: NumberFormat = { kind: 'digits', maxLength: 4 };

  it('keeps leading zeros', () => {
    expect(press(['0', '1', '2', '3'], passcode)).toBe('0123');
  });

  it('ignores the decimal point', () => {
    expect(press(['1', '.', '2'], passcode)).toBe('12');
  });

  it('stops at the maximum length', () => {
    expect(press(['1', '2', '3', '4', '5'], passcode)).toBe('1234');
  });

  it('deletes the last digit, and does nothing when empty', () => {
    expect(press(['1', '2', 'backspace'], passcode)).toBe('1');
    expect(press(['backspace'], passcode)).toBe('');
  });
});

describe('money', () => {
  const money: NumberFormat = { kind: 'money', maxWholeDigits: 6 };

  it('types dollars and cents', () => {
    expect(press(['1', '2', '.', '3', '4'], money)).toBe('12.34');
  });

  it('allows at most two decimals', () => {
    expect(press(['1', '.', '9', '9', '9'], money)).toBe('1.99');
  });

  it('allows only one decimal point', () => {
    expect(press(['1', '.', '.', '5'], money)).toBe('1.5');
    expect(press(['1', '.', '5', '.'], money)).toBe('1.5');
  });

  it('starts with "0." when the decimal point comes first', () => {
    expect(press(['.', '5'], money)).toBe('0.5');
  });

  it('replaces a lone leading zero instead of keeping it', () => {
    expect(press(['0', '5'], money)).toBe('5');
    expect(press(['0', '0'], money)).toBe('0');
    expect(press(['0', '.', '0', '5'], money)).toBe('0.05');
  });

  it('caps the whole-dollar digits but still allows cents', () => {
    expect(press(['9', '9', '9', '9', '9', '9', '9'], money)).toBe('999999');
    expect(press(['.', '4', '5'], money, '999999')).toBe('999999.45');
  });

  it('backspace removes the decimal point too', () => {
    expect(press(['1', '.', 'backspace', '2'], money)).toBe('12');
  });
});

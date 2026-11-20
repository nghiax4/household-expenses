// What the in-app number pad does to the typed text, one key at a time. Pure, so every rule
// is unit-tested; the pad itself only draws buttons.

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type NumberPadKey = Digit | '.' | 'backspace';

/**
 * - `digits`: a code such as the passcode. Leading zeros count ("0123"), no decimal point.
 * - `money`: dollars with at most 2 decimals ("12.5", "0.99"). No leading zeros ("05" is "5").
 */
export type NumberFormat =
  { kind: 'digits'; maxLength: number } | { kind: 'money'; maxWholeDigits: number };

/** Returns the text after pressing `key`. A key that would break the format changes nothing. */
export function applyNumberPadKey(text: string, key: NumberPadKey, format: NumberFormat): string {
  if (key === 'backspace') {
    return text.slice(0, -1);
  }
  if (format.kind === 'digits') {
    return key !== '.' && text.length < format.maxLength ? text + key : text;
  }

  const [whole = '', fraction] = text.split('.');
  if (key === '.') {
    if (fraction !== undefined) {
      return text;
    }
    return text === '' ? '0.' : `${text}.`;
  }
  if (fraction !== undefined) {
    return fraction.length < 2 ? text + key : text;
  }
  if (whole === '0') {
    return key;
  }
  return whole.length < format.maxWholeDigits ? text + key : text;
}

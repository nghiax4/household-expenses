import type { Digit, NumberPadKey } from './numberEntry';

interface Props {
  onKey: (key: NumberPadKey) => void;
  /** Money needs a "." key; a passcode doesn't. */
  showDecimalPoint: boolean;
}

const DIGIT_ROWS: Digit[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

const KEY_STYLE =
  'h-14 rounded-xl bg-slate-100 text-2xl font-medium text-slate-900 select-none active:bg-slate-300';

/**
 * Plain on-page buttons instead of the iOS number keyboard, which is slow to slide up on
 * older iPhones (see docs/requirements.md → "Input").
 */
export function NumberPad({ onKey, showDecimalPoint }: Props) {
  const key = (value: NumberPadKey, label: string, ariaLabel?: string) => (
    <button
      key={value}
      type="button"
      aria-label={ariaLabel}
      onClick={() => onKey(value)}
      className={KEY_STYLE}
    >
      {label}
    </button>
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {DIGIT_ROWS.flat().map((digit) => key(digit, digit))}
      {showDecimalPoint ? key('.', '.', 'Decimal point') : <span aria-hidden="true" />}
      {key('0', '0')}
      {key('backspace', '⌫', 'Delete')}
    </div>
  );
}

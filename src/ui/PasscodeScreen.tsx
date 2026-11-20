import { useState, type FormEvent } from 'react';
import { callBackend } from '../api/client';
import { NumberPad } from './input/NumberPad';
import { applyNumberPadKey, type NumberFormat, type NumberPadKey } from './input/numberEntry';

interface Props {
  onUnlocked: (passcode: string) => void;
}

// Longer than any household code we'd pick; it just keeps the dots on one line.
const PASSCODE_FORMAT: NumberFormat = { kind: 'digits', maxLength: 8 };

export function PasscodeScreen({ onUnlocked }: Props) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  function handleKey(key: NumberPadKey) {
    setPasscode((text) => applyNumberPadKey(text, key, PASSCODE_FORMAT));
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(null);
    const result = await callBackend({ passcode, action: 'checkPasscode' });
    setChecking(false);
    if (result.ok) {
      onUnlocked(passcode);
    } else {
      // Start over, like the iPhone lock screen, instead of making people delete digit by digit.
      setPasscode('');
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
      <p id="passcode-label" className="font-medium">
        Household passcode
      </p>
      {/* Dots, not a text box: a text box would open the iOS keyboard. */}
      <output
        aria-labelledby="passcode-label"
        className="flex h-12 items-center justify-center gap-3 rounded-lg border border-slate-300 text-2xl"
      >
        {Array.from(passcode, (_, i) => (
          <span key={i}>•</span>
        ))}
      </output>
      {/* Always takes up its line, so the pad never shifts between taps when an error
          appears or clears. */}
      <p role="alert" className="min-h-5 text-sm text-red-700">
        {error}
      </p>
      <NumberPad onKey={handleKey} showDecimalPoint={false} />
      <button
        type="submit"
        disabled={checking || passcode === ''}
        className="rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {checking ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}

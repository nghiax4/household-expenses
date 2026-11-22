import { useState, type FormEvent } from 'react';
import { callBackend } from '../api/client';
import { Waiting } from './Waiting';

interface Props {
  onUnlocked: (passcode: string) => void;
}

// Longer than any household code we'd pick; it only stops runaway typing.
const MAX_PASSCODE_LENGTH = 8;

export function PasscodeScreen({ onUnlocked }: Props) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

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
      <label htmlFor="passcode" className="font-medium">
        Household passcode
      </label>
      {/* A text box rather than type="password": it reliably brings up the iPhone's digit keypad
          and doesn't make Safari offer to save a password. The dots come from text-security. */}
      <input
        id="passcode"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={passcode}
        onChange={(event) => {
          setPasscode(event.target.value.replace(/\D/g, '').slice(0, MAX_PASSCODE_LENGTH));
          setError(null);
        }}
        className="h-12 rounded-lg border border-slate-300 text-center indent-[0.5em] text-2xl tracking-[0.5em] [-webkit-text-security:disc]"
      />
      {/* Always takes up its line, so the button below never shifts when an error appears or
          clears. */}
      <p role="alert" className="min-h-5 text-sm text-red-700">
        {error}
      </p>
      <button
        type="submit"
        disabled={checking || passcode === ''}
        className="rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {checking ? <Waiting label="Checking" /> : 'Continue'}
      </button>
    </form>
  );
}

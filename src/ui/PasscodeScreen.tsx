import { useState, type FormEvent } from 'react';
import { callBackend } from '../api/client';

interface Props {
  onUnlocked: (passcode: string) => void;
}

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
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
      <label htmlFor="passcode" className="font-medium">
        Household passcode
      </label>
      {/* text-base (16px) stops iPhone Safari from zooming in when the field is tapped. */}
      <input
        id="passcode"
        type="password"
        autoComplete="off"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-base"
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={checking || passcode === ''}
        className="rounded-lg bg-slate-900 px-4 py-2 text-base font-medium text-white disabled:opacity-50"
      >
        {checking ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}

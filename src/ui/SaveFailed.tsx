import { useState } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type SheetData } from '../api/protocol';
import { Waiting } from './Waiting';

interface Props {
  /** Why the save failed, as the backend (or the network) said. */
  error: string;
  passcode: string;
  /** Gets the sheet read fresh; the caller shows it and closes what was open. */
  onLatest: (data: SheetData) => void;
  onPasscodeRejected: () => void;
}

/**
 * A failed save, with a button to load what the sheet holds now. Most failures mean this phone
 * showed old data (another phone saved meanwhile) or a timeout that may still have saved. The
 * refresh waits for a tap rather than happening by itself, so the screen doesn't change under
 * the user before they've read why.
 */
export function SaveFailed({ error, passcode, onLatest, onPasscodeRejected }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function showLatest() {
    setLoadError(null);
    setLoading(true);
    const result = await callBackend({ passcode, action: 'listExpenses' });
    setLoading(false);
    if (result.ok) {
      onLatest(result.value);
    } else if (result.error === WRONG_PASSCODE) {
      onPasscodeRejected();
    } else {
      setLoadError(result.error);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      <p role="alert" className="text-red-700">
        {loadError ?? error}
      </p>
      <button
        type="button"
        onClick={() => void showLatest()}
        disabled={loading}
        className="h-9 rounded-full border border-slate-400 px-4 font-medium active:bg-slate-100 disabled:opacity-50"
      >
        {loading ? <Waiting label="Loading" /> : 'Show the latest'}
      </button>
    </div>
  );
}

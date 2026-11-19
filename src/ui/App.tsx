import { useState } from 'react';
import { PasscodeScreen } from './PasscodeScreen';
import { loadSavedPasscode, savePasscode } from './savedPasscode';

export function App() {
  const [passcode, setPasscode] = useState(loadSavedPasscode);

  function handleUnlocked(newPasscode: string) {
    savePasscode(newPasscode);
    setPasscode(newPasscode);
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white px-4 py-6 text-slate-900">
      <h1 className="text-2xl font-semibold">Household Expenses</h1>
      {passcode === null ? (
        <PasscodeScreen onUnlocked={handleUnlocked} />
      ) : (
        <p className="mt-2 text-slate-600">You’re in. Expenses are coming soon.</p>
      )}
    </main>
  );
}

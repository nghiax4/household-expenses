import { useCallback, useState } from 'react';
import { ExpensesScreen } from './ExpensesScreen';
import { PasscodeScreen } from './PasscodeScreen';
import { forgetPasscode, loadSavedPasscode, savePasscode } from './savedPasscode';

export function App() {
  const [passcode, setPasscode] = useState(loadSavedPasscode);

  function handleUnlocked(newPasscode: string) {
    savePasscode(newPasscode);
    setPasscode(newPasscode);
  }

  // Stable, because the expenses screen reloads whenever its props change.
  const handlePasscodeRejected = useCallback(() => {
    forgetPasscode();
    setPasscode(null);
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white px-4 py-6 text-slate-900">
      <h1 className="text-2xl font-semibold">Household Expenses</h1>
      {passcode === null ? (
        <PasscodeScreen onUnlocked={handleUnlocked} />
      ) : (
        <ExpensesScreen passcode={passcode} onPasscodeRejected={handlePasscodeRejected} />
      )}
    </main>
  );
}

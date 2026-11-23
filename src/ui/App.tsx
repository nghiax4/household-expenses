import { useCallback, useState } from 'react';
import { PasscodeScreen } from './PasscodeScreen';
import { forgetPasscode, loadSavedPasscode, savePasscode } from './savedPasscode';
import { ScrollFades } from './ScrollFades';
import { UnlockedApp } from './UnlockedApp';

export function App() {
  const [passcode, setPasscode] = useState(loadSavedPasscode);

  function handleUnlocked(newPasscode: string) {
    savePasscode(newPasscode);
    setPasscode(newPasscode);
  }

  // Stable, because the app reloads the sheet whenever its props change.
  const handlePasscodeRejected = useCallback(() => {
    forgetPasscode();
    setPasscode(null);
  }, []);

  return (
    // The bottom padding keeps the end of every screen clear of the tab bar.
    <main className="mx-auto min-h-screen max-w-md bg-white px-4 pt-6 pb-24 text-slate-900">
      <ScrollFades edges="screen">
        <h1 className="text-2xl font-semibold">Household Expenses</h1>
        {passcode === null ? (
          <PasscodeScreen onUnlocked={handleUnlocked} />
        ) : (
          <UnlockedApp passcode={passcode} onPasscodeRejected={handlePasscodeRejected} />
        )}
      </ScrollFades>
    </main>
  );
}

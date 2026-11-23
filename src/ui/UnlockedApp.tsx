import { useEffect, useState } from 'react';
import { callBackend } from '../api/client';
import { WRONG_PASSCODE, type SheetData } from '../api/protocol';
import { ExpensesScreen } from './ExpensesScreen';
import { NotesScreen } from './NotesScreen';
import { SettleScreen } from './SettleScreen';
import { TabBar, type Tab } from './TabBar';
import { Waiting } from './Waiting';

interface Props {
  passcode: string;
  /** The saved passcode no longer works (it was changed), so ask for it again. */
  onPasscodeRejected: () => void;
}

type Loading =
  { state: 'loading' } | { state: 'failed'; error: string } | { state: 'ready'; data: SheetData };

/**
 * Loads the sheet once and shares it between the screens: a settlement locks expenses, so both
 * must see the same data. Every save hands back the sheet read fresh, which replaces it here.
 */
export function UnlockedApp({ passcode, onPasscodeRejected }: Props) {
  const [loading, setLoading] = useState<Loading>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>('expenses');

  useEffect(() => {
    let current = true;
    void callBackend({ passcode, action: 'listExpenses' }).then((result) => {
      if (!current) {
        return;
      }
      if (result.ok) {
        setLoading({ state: 'ready', data: result.value });
      } else if (result.error === WRONG_PASSCODE) {
        onPasscodeRejected();
      } else {
        setLoading({ state: 'failed', error: result.error });
      }
    });
    return () => {
      current = false;
    };
  }, [passcode, attempt, onPasscodeRejected]);

  if (loading.state === 'loading') {
    return (
      <p className="mt-6 text-slate-600">
        <Waiting label="Loading expenses" />
      </p>
    );
  }
  if (loading.state === 'failed') {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p role="alert" className="text-red-700">
          {loading.error}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading({ state: 'loading' });
            setAttempt((n) => n + 1);
          }}
          className="h-12 rounded-lg border border-slate-300 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const setData = (data: SheetData) => setLoading({ state: 'ready', data });
  const shared = { data: loading.data, passcode, onData: setData, onPasscodeRejected };
  return (
    <>
      {/* All stay mounted, so a half-typed expense or note survives a look at another screen. */}
      <div hidden={tab !== 'expenses'}>
        <ExpensesScreen {...shared} />
      </div>
      <div hidden={tab !== 'settle'}>
        <SettleScreen {...shared} />
      </div>
      <div hidden={tab !== 'notes'}>
        <NotesScreen {...shared} />
      </div>
      <TabBar
        current={tab}
        onChange={(next) => {
          setTab(next);
          window.scrollTo(0, 0);
        }}
      />
    </>
  );
}

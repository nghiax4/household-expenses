// Each phone enters the household passcode once; it's kept in the browser's local storage.
// Storage can be unavailable (private browsing, blocked site data), so failures just mean
// the passcode is asked for again.
const KEY = 'household-expenses.passcode';

export function loadSavedPasscode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** For when the household passcode has changed: the phone asks for the new one. */
export function forgetPasscode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was saved, so there's nothing to forget.
  }
}

export function savePasscode(passcode: string): void {
  try {
    localStorage.setItem(KEY, passcode);
  } catch {
    // Not saved: the app still works for this visit.
  }
}

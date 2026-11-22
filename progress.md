# Progress: Budgeting App

## Project overview
A **mobile-first shared-expense web app** (Splitwise-style) for the household. It replaces tab **sheet2** of the household's Google Sheet. Access is by shared link with a household passcode and no user accounts.

- Full spec: `docs/requirements.md`. Decisions and reasons: `docs/decisions.md`.
- Stack: React + TypeScript + Vite + Tailwind (GitHub Pages) → Google Apps Script backend → a new private Google Sheet as storage.
- **This repo is public.** Real names, amounts and links live only in `docs/private-notes.md` (git-ignored). Read it for how sheet2 works today, who's in the household, and the Drive links.

### How the current sheet works (summary; details in private notes)
- One row per expense: description, date, total, per-person share, payer, then a Paid / Not paid / Not involved status per person, then a few extra columns (two unused ones get dropped).
- 7 people: 4 roommates plus 3 occasional. The total is split equally among everyone involved.
- **Meaning of "Paid":** for the payer, it means they fronted the bill. For anyone else, it means they've paid their share back.
- Recurring bills: rent, Internet, electricity, insurance.
- The user corrects data directly in the sheet. Always re-read the live sheet at import time.

## Current status
**Phase 3: MVP screens.** The site is live at https://nghiax4.github.io/household-expenses/ (public repo `nghiax4/household-expenses`, auto-deployed from `main`). The real storage sheet exists (5 tabs; ID in private notes) and holds only test expense #1. The backend (redeployed 2026-11-22) checks the passcode, lists and adds expenses, and marks shares paid (each write under a lock, with Activity entries). The app has the passcode screen, the **expense list** and the **Add expense form**, pushed 2026-11-22 and live. **Custom and % splits** on the Add form pushed 2026-11-22. Both work against the live backend: on 2026-11-22 the user added test expense #1 ("TEST phone check lol", $1.01) from their iPhone, and the row, person cells and Activity entry were correct in the real sheet. That row should go to the trash once trash exists (ask first). **Marking shares paid** (a "Mark who paid" checklist on each card, one Save) is built, tested, deployed on the backend and tried on the phone, and every wait now shows a spinner with a seconds counter (the app gives up after 60 s); both pushed 2026-11-22. `src/domain/` holds the money logic, fully unit-tested. Typing uses the iPhone keyboard (spec in `docs/requirements.md` → "Input").

## Next steps
1. ~~Storage layout sign-off~~. **Layout 1 approved** on 2026-11-17 (sheet2-style: Expenses, Settlements, Templates, Activity, plus an **Ideas** tab added 2026-11-19). The schema is in `docs/requirements.md` → "Storage schema".
   - A sample storage sheet exists in the user's personal Drive (link and contents in private notes). The user wants to keep it until the real sheet exists.
   - The previous 7-tab design (View/People/Shares…) is superseded but recorded in `docs/decisions.md` in case the user wants to go back.
2. ~~Scaffold the project~~ (done 2026-11-19; layout in `docs/decisions.md` and CLAUDE.md). The core domain logic is done too.
3. ~~Publish + backend slice~~ (done 2026-11-19): repo, Pages, backend, storage sheet, passcode screen.
4. ~~Delete the two empty "Who" columns~~ (done 2026-11-20). The backup copy can be trashed once the user is happy (ask first).
5. Build the MVP features (see `docs/requirements.md`). ~~List expenses~~ and ~~add expense (equal split)~~ done 2026-11-21, ~~tried against the real sheet~~ 2026-11-22, ~~Paid toggles~~ and the loading spinner done 2026-11-22; ~~custom/% splits~~ done 2026-11-22. ~~templates~~ built 2026-11-22. Next: settlements → activity log + trash → search/filter → "what I owe" → Ideas screen. Every write needs an Activity entry (the lock already covers every request).
6. Import sheet2 (copy the storage sheet first; ask about rows with no date).

## Open questions
- How to handle sheet2 rows with no date (examples in private notes) at import time.

## Session log
<!-- Newest first. Keep the 5 most recent; move older entries to docs/session-history.md -->

### 2026-11-22 (real-sheet test, payer hint, Paid toggles, loading)
- Session start: no notes in the Ideas tab. All checks passed on last session's uncommitted work.
- The user added a test expense from their iPhone (dev server over Wi-Fi) with the payer **left out of the split** on purpose. The real sheet read back correct: row #1, the extra cents going to the first people in column order, and the Activity entry.
- The user asked whether a payer outside the split should be allowed. It's in the spec on purpose (paying only for others), so the user kept it, and the Add form now shows a hint under the share preview when it happens. E2E test extended; iPhone screenshot checked with made-up data. Spec in `docs/requirements.md`.
- Links given to the user are plain (no `/u/1/`): they use several Chrome profiles.
- Committed and pushed (with the 2026-11-21 work) at the user's OK.
- Built **Paid toggles**, first as tappable chips with an "ask first" box (backend action `setShareStatus`). The user tried it on the phone (worked) but found the chips didn't look tappable. After comparing six designs (mockups in chat), they chose **F**: plain chips plus a **Mark who paid** button that opens a checklist (checkbox + colored chip + "Paid back" / "Not paid"; the payer's row says "Paid the bill"), saved with one Save. The backend action became `setShareStatuses` (only changed shares, checked all-or-nothing, one Activity row each); shared rule `withShareStatuses` in `src/domain/expense.ts`. 165 unit and 20 e2e tests pass; iPhone screenshots of the cards and checklist checked. Backend redeployed (user's OK) and checked with a refused request that wrote nothing.
- The user tried the checklist on their iPhone against the real sheet: "works well".
- Added a **spinner with a seconds counter** (from 0s, at the user's request) to every wait and a **60-second give-up** in `src/api/client.ts` (before, the app had no time limit of its own). New `src/ui/Waiting.tsx`; e2e test fast-forwards the clock against a backend that never answers. 165 unit and 22 e2e tests pass; iPhone screenshots of the counter and the give-up message checked.
- Committed and pushed (user's OK). The counter later changed to count from 0s (user's request), also pushed.
- Built **custom and % splits** on the Add form: a 3-way switch Equally / Amounts / Percent, boxes per person that start at the equal split, and a live "left to split / too much / ✓ adds up" line. New `SplitPicker.tsx` and `Choice.tsx` (split out of the form); `parseTypedPercent`, `formatPercent` and `sharesFromTyped` in `src/domain/split.ts`. No backend change (it already took any shares). 192 unit and 24 e2e tests pass; iPhone screenshots checked. The user tried it on their iPhone ("works"); the boxes were then left-aligned so a tap puts the cursor after the number (e2e test checks it, and fails on the old style). Committed and pushed (user's OK).
- Added **scroll cues**: gray shadows at the top/bottom edge while there's more to scroll, on every screen and inside the checklist box (`src/ui/ScrollFades.tsx`, IntersectionObserver on end markers). The user asked for a very visible scrollbar; iPhone Safari can't do that without faking one, so they picked edge fades. Also fixed a flaky e2e test (the slow-save test's fake clock now stays paused). 192 unit and 26 e2e tests pass; iPhone screenshots checked. The user tried it on their iPhone ("good"); committed and pushed.
- Built **quick-add templates**, edited only in the sheet (the user's idea; Claude does the edits). The backend reads the Templates tab with every load (`apps-script/src/templatesTab.ts`; bad rows skipped and explained); the Add form shows **Quick fill** buttons that fill description, payer, people and default amount (at first Total also got focus when there was no default; removed at the user's request because the keypad popping up was annoying). `ExpensesData` renamed `SheetData`. Backend redeployed. Claude typed the 4 starting rows (English names; rent and electricity without a default) in Chrome after confirming the sheet's protection warning; read back through the live backend: all 4 parse, no problems. 199 unit and 28 e2e tests pass; iPhone screenshot checked. The user tried it on their iPhone; committed and pushed (user's OK).

### 2026-11-21 (expense list + add form)
- Session start: no notes in the Ideas tab. Committed and pushed the 2026-11-20 work first (user's OK). Backup copy of the storage sheet kept for now.
- Built the **expense list** and the **Add expense form** (equal split), end to end: shared rules in `src/domain/expense.ts` (`buildExpense`, typed-amount parsing in `money.ts`), backend actions `listExpenses`/`addExpense` (`apps-script/src/expensesTab.ts`, lock + Activity row + read-back), and the screens in `src/ui/`. Decisions in `docs/decisions.md`; spec in `docs/requirements.md` → "Expense list and Add form".
- Product choices made for the user (they deferred; easy to change after trying it): no default payer or participants; up to 6 recent-description chips (description only); unreadable rows hidden with a yellow banner.
- Tests: 147 unit, 14 e2e (desktop Chrome + iPhone WebKit) all pass; e2e now fail on any page error and check the add form fits the iPhone width (a date-box overflow was found and fixed this way). iPhone and desktop screenshots checked with made-up data. Claude in Chrome wasn't connected, so the desktop check used Playwright's Chrome.
- Backend redeployed (same URL). Live check from the terminal: right passcode works, wrong one is refused, `listExpenses` reads the real (empty) sheet with all 7 people.
- Committed and pushed on 2026-11-22, after the user tried adding against the real sheet.

### 2026-11-20 (keyboard try-out)
- Session start: still no notes in the Ideas tab.
- **Removed the empty "Who" columns** from the real storage sheet in Claude in Chrome (Activity B, Ideas C), after making a backup copy (name and ID in private notes; can be trashed once the user is happy). Read back with the Drive connector: Activity is Time, Action, Details; Ideas is ID, Created at, Note, Status, Outcome. The Status dropdown moved to D2:D1000 as expected (checked in the Data validation panel).
- Built a Telex engine and an iPhone-style letter keyboard on a hidden test page, with unit and e2e tests. The user tried it on their iPhone through the dev server on the local network (`dev-lan` in `.claude/launch.json`, opened at the laptop's Wi-Fi address), then a real text box for comparison, and **chose the iPhone keyboard** ("imperfect here and there"; the earlier slowness was likely Safari's page zoom at 50%). Per the user, all of that code was **deleted without committing**. The smoke test no longer forbids text boxes.
- Decided: Today / Yesterday buttons plus the iPhone date picker for dates. Updated `docs/requirements.md` → "Input" and `docs/decisions.md`.
- Numbers use the iPhone keypad too (user's choice): the passcode screen is now a text box with `inputmode="numeric"` (digits only, shown as dots), and the app's number pad (`src/ui/input/`) was deleted (it stays in git history). Amounts will use `inputmode="decimal"` and be checked on save. The user tried the new passcode box on their iPhone (dev server over Wi-Fi) and said it works fine.
- Committed and pushed at the start of the 2026-11-21 session.


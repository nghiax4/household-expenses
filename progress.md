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
**Phase 2: Every piece is connected.** The site is live at https://nghiax4.github.io/household-expenses/ (public repo `nghiax4/household-expenses`, auto-deployed from `main`). The Apps Script backend is deployed and checks the passcode. The real storage sheet exists (5 tabs, formatting, validation, protection warnings; ID in private notes). The app's only real screen so far is the passcode screen, which talks to the live backend and uses the iPhone's digit keypad. `src/domain/` holds the money logic (splits, person cells, settlement), fully unit-tested. Typing uses the iPhone keyboard (decided 2026-11-20 after trying a custom one; spec in `docs/requirements.md` → "Input"). Next: the MVP screens, in the order under "Next steps".

## Next steps
1. ~~Storage layout sign-off~~. **Layout 1 approved** on 2026-11-17 (sheet2-style: Expenses, Settlements, Templates, Activity, plus an **Ideas** tab added 2026-11-19). The schema is in `docs/requirements.md` → "Storage schema".
   - A sample storage sheet exists in the user's personal Drive (link and contents in private notes). The user wants to keep it until the real sheet exists.
   - The previous 7-tab design (View/People/Shares…) is superseded but recorded in `docs/decisions.md` in case the user wants to go back.
2. ~~Scaffold the project~~ (done 2026-11-19; layout in `docs/decisions.md` and CLAUDE.md). The core domain logic is done too.
3. ~~Publish + backend slice~~ (done 2026-11-19): repo, Pages, backend, storage sheet, passcode screen.
4. ~~Delete the two empty "Who" columns~~ (done 2026-11-20). The backup copy can be trashed once the user is happy (ask first).
5. Build the MVP features (see `docs/requirements.md`). Suggested order: load + list expenses (cards with a red/green chip per participant) → add expense (iPhone keyboard for text, Today/Yesterday + the iPhone date picker, equal split first, recent-description chips) → Paid toggles → custom/% splits → templates → settlements → activity log + trash → search/filter → "what I owe" → Ideas screen. Writes need `LockService` and Activity entries.
6. Import sheet2 (copy the storage sheet first; ask about rows with no date).

## Open questions
- How to handle sheet2 rows with no date (examples in private notes) at import time.

## Session log
<!-- Newest first. Keep the 5 most recent; move older entries to docs/session-history.md -->

### 2026-11-20 (keyboard try-out)
- Session start: still no notes in the Ideas tab.
- **Removed the empty "Who" columns** from the real storage sheet in Claude in Chrome (Activity B, Ideas C), after making a backup copy (name and ID in private notes; can be trashed once the user is happy). Read back with the Drive connector: Activity is Time, Action, Details; Ideas is ID, Created at, Note, Status, Outcome. The Status dropdown moved to D2:D1000 as expected (checked in the Data validation panel).
- Built a Telex engine and an iPhone-style letter keyboard on a hidden test page, with unit and e2e tests. The user tried it on their iPhone through the dev server on the local network (`dev-lan` in `.claude/launch.json`, opened at the laptop's Wi-Fi address), then a real text box for comparison, and **chose the iPhone keyboard** ("imperfect here and there"; the earlier slowness was likely Safari's page zoom at 50%). Per the user, all of that code was **deleted without committing**. The smoke test no longer forbids text boxes.
- Decided: Today / Yesterday buttons plus the iPhone date picker for dates. Updated `docs/requirements.md` → "Input" and `docs/decisions.md`.
- Numbers use the iPhone keypad too (user's choice): the passcode screen is now a text box with `inputmode="numeric"` (digits only, shown as dots), and the app's number pad (`src/ui/input/`) was deleted (it stays in git history). Amounts will use `inputmode="decimal"` and be checked on save. The user tried the new passcode box on their iPhone (dev server over Wi-Fi) and said it works fine.
- Committed and pushed at the start of the 2026-11-21 session.


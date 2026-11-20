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
**Phase 2: Every piece is connected.** The site is live at https://nghiax4.github.io/household-expenses/ (public repo `nghiax4/household-expenses`, auto-deployed from `main`). The Apps Script backend is deployed and checks the passcode. The real storage sheet exists (5 tabs, formatting, validation, protection warnings; ID in private notes). The app's only screen so far is the passcode screen, which talks to the live backend and now uses the in-app number pad (no iOS keyboard). `src/domain/` holds the money logic (splits, person cells, settlement), fully unit-tested. New since 2026-11-20: the app will never open the iOS keyboard; it gets its own number pad and a Telex letter keyboard (spec in `docs/requirements.md` → "Input"). Next: the MVP screens, in the order under "Next steps".

## Next steps
1. ~~Storage layout sign-off~~. **Layout 1 approved** on 2026-11-17 (sheet2-style: Expenses, Settlements, Templates, Activity, plus an **Ideas** tab added 2026-11-19). The schema is in `docs/requirements.md` → "Storage schema".
   - A sample storage sheet exists in the user's personal Drive (link and contents in private notes). The user wants to keep it until the real sheet exists.
   - The previous 7-tab design (View/People/Shares…) is superseded but recorded in `docs/decisions.md` in case the user wants to go back.
2. ~~Scaffold the project~~ (done 2026-11-19; layout in `docs/decisions.md` and CLAUDE.md). The core domain logic is done too.
3. ~~Publish + backend slice~~ (done 2026-11-19): repo, Pages, backend, storage sheet, passcode screen.
4. **Delete the two empty "Who" columns** in the real storage sheet (Activity column B, Ideas column C; the user approved it 2026-11-20). In Claude in Chrome: copy the sheet first, delete the columns, then read the tabs back with the Drive connector and check that the Ideas Status dropdown moved to D2:D1000.
5. Build the MVP features (see `docs/requirements.md`). Suggested order: load + list expenses (cards with a red/green chip per participant) → **in-app input** (~~number pad~~ done; Telex engine in `src/ui/input/` with unit tests; letter keyboard; Today/Yesterday + calendar) → add expense (equal split first, with recent-description chips) → Paid toggles → custom/% splits → templates → settlements → activity log + trash → search/filter → "what I owe" → Ideas screen. Writes need `LockService` and Activity entries.
6. Import sheet2 (copy the storage sheet first; ask about rows with no date).

## Open questions
- How to handle sheet2 rows with no date (examples in private notes) at import time.

## Session log
<!-- Newest first. Keep the 5 most recent; move older entries to docs/session-history.md -->

### 2026-11-20
- Session start: the storage sheet's Ideas tab has no notes yet.
- New requirement from the user: **no iOS keyboard or pickers** (slow on their iPhone). Decided: an in-app number pad; an in-app letter keyboard used everywhere text is typed, with Telex (modern tone placement, VN/EN key, VN default, converts only valid Vietnamese syllables); Today/Yesterday + an in-app calendar for dates; recent-description chips. Written into `docs/requirements.md` ("Input") and `docs/decisions.md`.
- The user dropped the per-device display name: every phone gets the same UI, and the app doesn't record who made a change. Removed "Who" from the Activity and Ideas schema. The expense list will use cards with a red/green chip per participant.
- Updated the GitHub Actions to their Node 24 versions (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5). The deploy passed with no Node 20 warning.
- Built the **number pad** (`src/ui/input/`: `numberEntry.ts`, a pure key-handling function in digits and money modes with unit tests, and `NumberPad.tsx`), and switched the passcode screen to it: dots instead of a text box, cleared after a failed try, and the error line always keeps its space so the pad never shifts between taps. App-wide `touch-action: manipulation` stops double-tap zoom. A smoke e2e test now fails if any input/textarea/select/contenteditable appears. Checked with iPhone screenshots (empty, typing, wrong passcode).
- Not done: Claude in Chrome wasn't connected, so the "Who" columns are still in the real sheet (Next steps #4). Next: the Telex engine, then the letter keyboard. The user hasn't tried the number pad on the phone yet.

### 2026-11-19 (publishing)
- Decided: public repo `nghiax4/household-expenses` with free GitHub Pages. The author email on commits stays as it is (the user's GitHub is public on purpose). Friends' names and real amounts must not be public: moved them to git-ignored `docs/private-notes.md`, made the public docs neutral, and switched tests to made-up data. Old commits still contained the names, so the history was squashed into one clean commit before the first push.
- Renamed the branch to `main` and added a GitHub Actions workflow that typechecks, lints, unit-tests, builds and deploys to Pages. Created the repo, pushed, and checked the live site in Chrome.
- Backend: TypeScript in `apps-script/`, bundled with esbuild and uploaded with clasp (signed in as the personal Gmail). The user turned on the Apps Script API, saved the PASSCODE property themselves (Claude may not type passcodes into sites), and approved the Sheets permission. Claude saved PEOPLE. `setupStorage` created the real storage sheet. Checked it two read-only ways: through the Drive connector and by viewing it in Chrome (all 5 tabs, headers, people columns, 4 color rules, protection warning). Deployed as a web app and tested it with curl: health check, wrong code, right code, malformed request.
- App: passcode screen → backend → remembered per phone (localStorage). E2E tests use a fake backend. Tested against the live backend from Chrome with a wrong code: "Wrong passcode." came back, so browser calls to Google work.
- Committed and pushed as two commits (backend; passcode screen + docs). **The user confirmed the live site works on their iPhone with the real passcode.**
- The passcode is in private notes. CLAUDE.md now says how to test with it (terminal calls OK; never typed into web pages; the user enters it once per Chrome tab/site).
- Left over: (1) the CLAUDE.md testing note above isn't committed yet; (2) the user may not have entered the passcode in Claude's Chrome tabs yet (live site + localhost:5173); (3) GitHub warns the workflow's actions (checkout/setup-node/upload-pages-artifact v4/v3) run on deprecated Node 20, so bump them to their newer major versions.
- The user asked for a non-destructive approach with their Google account; the rules are now in CLAUDE.md.

### 2026-11-19 (project setup)
- Clarified the performance rule in CLAUDE.md: readability decides, and speed counts neither for nor against.
- Scaffolded the project by hand (no Vite template demo files): npm, Vite 8, React 19, TypeScript 6, Tailwind 4, Vitest 5, Playwright, ESLint 10 + Prettier. Placeholder home screen only.
- Decided (the user deferred to Claude): backend in TypeScript under `apps-script/`, sharing `src/domain` with the app.
- Wrote `src/domain/`: `money.ts`, `personCell.ts`, `split.ts`, `settlement.ts`, `expense.ts`, `result.ts`, with unit tests, including 500 random settlement cases checked against a brute-force solver. Confirmed the tests catch bugs by breaking the payer-cents rule and the settlement grouping on purpose (both failed as expected) and restoring them.
- The user said everyone uses an **iPhone**. Chrome's window couldn't reach iPhone width, so the phone e2e tests run in **WebKit** (Safari's engine) as an iPhone 15, and `npm run screenshot` takes iPhone screenshots for visual checks.

### 2026-11-19
- The user asked for a new MVP feature: an **Ideas** inbox for undecided changes to the app, to jot down on the phone and discuss later with Claude Code. Decided: anyone can add or edit a note; Status Open/Done/Dropped plus a one-line Outcome; no delete; not written to Activity.
- Tested the Google Drive connector on the sample sheet: it reads every tab of the personal-account sheet (read-only). Added a start-of-session step to CLAUDE.md that lists Open ideas from the real sheet once it exists.
- Added an **Ideas** tab to the sample sheet in Chrome, with 3 made-up notes and a Status dropdown that rejects other values. Tested: "Maybe" was rejected, and the Drive connector read the tab back correctly.

### 2026-11-17 (second session)
- The user reviewed the sample sheet again and asked for an explicit **"Not involved"** state in Expenses (decided: plain "Not involved" text, never blank, gray text with no fill).
- Updated the sample in Chrome: filled every non-participant cell with "Not involved", added the gray formatting rule, and made the validation case-sensitive (`EXACT`). Sheets never validates empty cells, so a separate yellow highlight now flags a blank cell on an expense row.
- Tested in the sample: lowercase "not involved", junk text in an empty row, and a blank cell on an expense row are all flagged, and valid cells aren't. The test edits were then reverted.

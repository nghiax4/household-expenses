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
**Phase 1: Project set up; core money logic done.** Planning is complete (requirements, architecture, storage "layout 1" with "Not involved" cells, and the Ideas inbox). The project is scaffolded (Vite + React + TS + Tailwind, Vitest, Playwright, ESLint, Prettier), and `npm run check` passes. `src/domain/` has the pure money logic with unit tests: dollar formatting and parsing, person cells (`"$12.34 · Paid"` / `"Not involved"`), equal/percentage/custom splits, and the fewest-transfers settlement. The UI is still a placeholder. In progress: publishing the repo and site, then the backend.

## Next steps
1. ~~Storage layout sign-off~~. **Layout 1 approved** on 2026-11-17 (sheet2-style: Expenses, Settlements, Templates, Activity, plus an **Ideas** tab added 2026-11-19). The schema is in `docs/requirements.md` → "Storage schema".
   - A sample storage sheet exists in the user's personal Drive (link and contents in private notes). The user wants to keep it until the real sheet exists.
   - The previous 7-tab design (View/People/Shares…) is superseded but recorded in `docs/decisions.md` in case the user wants to go back.
2. ~~Scaffold the project~~ (done 2026-11-19; layout in `docs/decisions.md` and CLAUDE.md). The core domain logic is done too.
3. Publish: public repo `nghiax4/household-expenses` with GitHub Pages (deploy workflow in `.github/workflows/deploy.yml`). Then the Apps Script backend: a setup function that creates the real storage sheet, a passcode check, and the app's passcode screen wired to it. Record the real sheet's file ID in private notes; CLAUDE.md's start-of-session step reads its Ideas tab.
4. Build the MVP features (see `docs/requirements.md`), then import sheet2.

## Open questions
- How to handle sheet2 rows with no date (examples in private notes) at import time.

## Session log
<!-- Newest first. Keep the 5 most recent; move older entries to docs/session-history.md -->

### 2026-11-19 (publishing)
- Decided: public repo `nghiax4/household-expenses` with free GitHub Pages. The author email on commits stays as it is (the user's GitHub is public on purpose). Friends' names and real amounts must not be public: moved them to git-ignored `docs/private-notes.md`, made the public docs neutral, and switched tests to made-up data. Old commits still contained the names, so the history was squashed into one clean commit before the first push.
- Renamed the branch to `main` and added a GitHub Actions workflow that typechecks, lints, unit-tests, builds and deploys to Pages.

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

### 2026-11-17
- Built a sample storage sheet in the user's personal Drive (generated an xlsx in the scratchpad, imported it into Google Sheets) and checked the settlement math against the source data.
- Decided: storage lives in the personal Gmail account; the payer absorbs leftover rounding cents; Expenses drops Created by / Created at (Activity is the single record of who did what); no "Settling" status at all; guiding principle: the storage sheet should read like the app.
- Added the user's **self-review and revision loop** rule (verbatim) to CLAUDE.md.
- The user asked for something even simpler. Proposed and built **layout 1** (sheet2-style; storage looks like the app). Settlements record "covers up to expense #N", and percentages are input-only (stored as amounts). The user approved it ("the sheet looks cool").

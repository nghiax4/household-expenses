# Session History (archive)

Older session log entries moved here from `progress.md`, which keeps only the 5 most recent. Newest first.

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

### 2026-11-17 (second session)
- The user reviewed the sample sheet again and asked for an explicit **"Not involved"** state in Expenses (decided: plain "Not involved" text, never blank, gray text with no fill).
- Updated the sample in Chrome: filled every non-participant cell with "Not involved", added the gray formatting rule, and made the validation case-sensitive (`EXACT`). Sheets never validates empty cells, so a separate yellow highlight now flags a blank cell on an expense row.
- Tested in the sample: lowercase "not involved", junk text in an empty row, and a blank cell on an expense row are all flagged, and valid cells aren't. The test edits were then reverted.

### 2026-11-17
- Built a sample storage sheet in the user's personal Drive (generated an xlsx in the scratchpad, imported it into Google Sheets) and checked the settlement math against the source data.
- Decided: storage lives in the personal Gmail account; the payer absorbs leftover rounding cents; Expenses drops Created by / Created at (Activity is the single record of who did what); no "Settling" status at all; guiding principle: the storage sheet should read like the app.
- Added the user's **self-review and revision loop** rule (verbatim) to CLAUDE.md.
- The user asked for something even simpler. Proposed and built **layout 1** (sheet2-style; storage looks like the app). Settlements record "covers up to expense #N", and percentages are input-only (stored as amounts). The user approved it ("the sheet looks cool").

### 2026-11-16
- Set up the folder for multi-session work: `CLAUDE.md`, `progress.md`, `docs/`, `.gitignore`, git init.
- Reviewed the user's Google Sheet in Chrome. Only **sheet2** is relevant. Flagged 3 inconsistent rows, and the user fixed them.
- Requirements: Splitwise-style splitter replacing sheet2. Shared link + passcode, mobile-first, all 7 people plus new ones, equal/custom/% splits, quick-add templates, per-expense Paid plus frozen min-transfer settlements, activity log + trash, search/filter, "what I owe" view, English UI, import all of sheet2. Spec written to `docs/requirements.md` (the user skimmed it and said it's OK).
- Architecture: Google Sheet storage (readable, full names as keys) via Apps Script, plus a React/TS/Vite/Tailwind frontend on GitHub Pages. Performance explicitly doesn't matter.
- Recorded the user's engineering standards in CLAUDE.md: senior SWE bar, careful review, Vitest + Playwright, screenshot checks in Claude in Chrome.

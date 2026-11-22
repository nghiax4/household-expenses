# Session History (archive)

Older session log entries moved here from `progress.md`, which keeps only the 5 most recent. Newest first.

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

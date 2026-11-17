# Session History (archive)

Older session log entries moved here from `progress.md`, which keeps only the 5 most recent. Newest first.

### 2026-11-16
- Set up the folder for multi-session work: `CLAUDE.md`, `progress.md`, `docs/`, `.gitignore`, git init.
- Reviewed the user's Google Sheet in Chrome. Only **sheet2** is relevant. Flagged 3 inconsistent rows, and the user fixed them.
- Requirements: Splitwise-style splitter replacing sheet2. Shared link + passcode, mobile-first, all 7 people plus new ones, equal/custom/% splits, quick-add templates, per-expense Paid plus frozen min-transfer settlements, activity log + trash, search/filter, "what I owe" view, English UI, import all of sheet2. Spec written to `docs/requirements.md` (the user skimmed it and said it's OK).
- Architecture: Google Sheet storage (readable, full names as keys) via Apps Script, plus a React/TS/Vite/Tailwind frontend on GitHub Pages. Performance explicitly doesn't matter.
- Recorded the user's engineering standards in CLAUDE.md: senior SWE bar, careful review, Vitest + Playwright, screenshot checks in Claude in Chrome.

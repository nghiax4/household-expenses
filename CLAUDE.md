# Budgeting App: Instructions for Claude

Claude Code loads this file automatically at the start of every session in this folder.

## Start of every session
When the user says "read progress.md, lets pick things up" (or anything similar):
1. Read `progress.md`, `docs/decisions.md`, `docs/requirements.md` and `docs/private-notes.md` (git-ignored: real people, amounts and Drive links).
2. Once the real storage sheet exists (its file ID is in `docs/private-notes.md`), read its **Ideas** tab with the Google Drive connector (`read_file_content`) and list every note whose Status is Open. These are the user's ideas from their phone, to discuss this session. The connector is read-only: after a note is discussed, the user sets its Status and Outcome in the app, or Claude does it in Chrome if asked.
3. Summarize in a few lines where things stand, the open ideas, and the next steps.
4. Ask clarifying questions to confirm the plan for this session before starting work.

## Working rules
- **Always ask clarifying questions** before starting any non-trivial task, so we agree on what will be built. Use the AskUserQuestion tool and offer concrete options. Don't guess at requirements.
- **Browser checks use Claude in Chrome** (the user asked for it by name), including for localhost pages. Exception: phone-size checks use the iPhone screenshot script (see "Review and testing").
- **Explanation level: medium.** Give brief reasons for bigger decisions such as architecture, libraries, and data model. Skip explanations for routine changes.
- **Git:** this folder is a git repo. Commit only when the user asks.
- **Non-destructive with the user's Google account** (the user asked for this explicitly). The backend only ever opens the one storage spreadsheet by its saved ID; never add code that lists, searches, moves or deletes Drive files. Never delete or overwrite Drive files, sheets or tabs, in code or in Chrome. Removing something means trash (recoverable), and only with the user's OK. Before any bulk change or data import, make a copy of the sheet first. Verify by reading, not by editing. Ask before anything destructive, even if it seems minor. Keep the script's permissions minimal (`appsscript.json` → `oauthScopes`).
- **The repo is public** (GitHub, `nghiax4/household-expenses`). Never commit friends' names, real amounts, or Drive/Sheet links: they go in `docs/private-notes.md`, which is git-ignored. Tests and examples use made-up people and amounts. Claude may know the real details; the rule is about what strangers can read. The user's own name and commit email are fine.
- **Claude is the main programmer.** The user directs and reviews, and doesn't write the code.
- **Performance does not matter** (tiny scale). Choose the most readable approach, and let speed count neither for nor against it. A worse big-O (O(n²), O(n³)) is fine when it reads more simply, even over expenses (~120 a year). But slower isn't automatically simpler: if the efficient algorithm is clearer (e.g., a clean DP vs. tangled backtracking), use it. Don't optimize ahead of time: the user will say if the app ever feels slow, and only then do we speed up the slow part.

## Engineering standards (senior SWE bar, for code and for how Claude works)
**Thinking**
- Before coding, restate the problem, consider a couple of approaches, and pick the simplest design that meets `docs/requirements.md`.
- When something feels off (a growing pile of special cases, a fix that doesn't explain the bug), stop and rethink the design instead of patching on top.
- Look for edge cases up front: rounding, empty states, deleted people, concurrent edits, bad data in the sheet.

**Code style**
- Clear names, small focused modules, precise TypeScript types (no `any`). Money is always integer cents.
- Keep domain logic (splits, balances, settlement DP) as **pure functions** separate from I/O (Apps Script/Sheets) and UI (React).
- Comments explain *why*, not *what*. No dead code, no commented-out code, no leftover debug logs.
- Use consistent formatting and linting (Prettier + ESLint).

**Organization**
- Keep the repo tidy and predictable. Every file has an obvious home. Update docs when the design changes.

**Self-review and revision loop (the user's rule, verbatim; applies to every deliverable: code, docs, sheets, answers)**
> Before handing the result back to me, perform a self-review and revision loop. Reread/reinspect the complete output and compare it against the original request, all provided source material, constraints, and intended deliverables. Identify any omissions, errors, inconsistencies, ambiguities, unnecessary duplication, weak organization, formatting problems, or other ways the result could be made more correct, complete, efficient, clear, or useful. Where applicable, use the available tools, tests, source files, or other validation methods to verify the work rather than relying only on your initial reasoning. Revise the output to address any issues you find, then review the entire result again. Repeat this review-and-revision cycle until a full pass reveals no substantive issues or worthwhile improvements. Do not stop after the first draft, and do not hand control back to me between review passes. Only return control to me once the final deliverable has been completed and reviewed.

How this fits with "always ask clarifying questions": ask questions **before** starting work, or when truly blocked on a decision only the user can make. Never stop mid-loop just to report progress.

**Review and testing (always, before calling anything done; part of the loop above)**
1. **Automated tests:**
   - Unit tests (Vitest) for all domain logic, especially split rounding and the settlement algorithm (including edge cases).
   - **End-to-end tests (Playwright) written alongside each user-facing feature**, from the start. Keep them focused on key flows rather than exhaustive, to avoid burning tokens on brittle tests.
   - Run typecheck, lint, unit and e2e tests, and fix failures.
2. **Code review of the diff:** re-read the full diff as a strict reviewer would. Check correctness, edge cases, error handling, naming, and fit with the requirements.
3. **Visual check of UI work in Claude in Chrome:** run the app and check it there. **Prefer screenshots** over text extraction (more reliable). Test both normal use and edge cases. **Phone check:** everyone in the household uses an iPhone, so check phone layouts with `npm run screenshot -- <out.png> [path]` (an iPhone 15 in WebKit, Safari's engine) and look at the image. Chrome can't get to iPhone width here, so use Claude in Chrome for the desktop check only (agreed with the user 2026-11-19).
4. **Report honestly:** what was tested and how, what passed, what wasn't covered, and any known issues. Never claim something works without having checked it.

## Keeping progress.md current (automatic, without being asked)
Update `progress.md` after each meaningful chunk of work and before the session wraps up:
- Update **Current status** and **Next steps**.
- Add an entry at the top of **Session log** with the date, what was done, and anything left unfinished.
- Keep only the 5 most recent session entries in progress.md. Move older ones to `docs/session-history.md`.
- Record any decision with lasting consequences (tech stack, data model, libraries, conventions) in `docs/decisions.md` with a one-line reason.
- Add unresolved questions to **Open questions**, and remove them once they're answered.

## Project layout
- `CLAUDE.md`: these instructions (auto-loaded).
- `progress.md`: living status: current state, next steps, recent sessions.
- `docs/requirements.md`: the agreed MVP spec. Keep it updated when requirements change.
- `docs/decisions.md`: log of key decisions and why they were made.
- `docs/session-history.md`: archive of older session log entries.
- `docs/private-notes.md`: real-world details (people, amounts, links). Git-ignored; never commit it.
- `src/domain/`: pure money logic (splits, person cells, settlement), with `*.test.ts` unit tests next to each file.
- `src/ui/`: React screens. `src/api/`: `protocol.ts` (request/response types shared with the backend) and `client.ts` (calls the backend; holds its URL).
- `e2e/`: Playwright tests (each runs in desktop Chrome and on an iPhone 15 in WebKit). `scripts/`: dev helpers, e.g., the iPhone screenshot script.
- `apps-script/`: the backend in TypeScript (`src/`), bundled by `build.mjs` into `dist/Code.js` and uploaded with clasp (`.clasp.json`, signed in as the user's personal Gmail). `handleRequest.ts` and `schema.ts` are pure and unit-tested; `main.ts` and `setupStorage.ts` talk to Google.
- Commands: `npm run dev` (local server), `npm run check` (typecheck, lint, format check, unit and e2e tests), `npm run screenshot -- <out.png> [path]` (iPhone screenshot; needs the dev server running), `npm run backend:deploy` (build, upload and redeploy the backend at the same URL). The site deploys to GitHub Pages automatically on every push to `main`. To let the user try unpushed work on their iPhone, start the `dev-lan` server from `.claude/launch.json` (the dev server open to the local network) and give them `http://<laptop Wi-Fi address>:5173`; the phone must be on the same Wi-Fi.
- Testing against the live backend: the passcode is in `docs/private-notes.md` (never in a committed file). Use it freely for direct backend calls from the terminal (e.g., `curl -sL -H 'Content-Type: text/plain' --data '{...}' <URL>`). Claude must never type it into a web page; for browser checks, ask the user to enter it once in Claude's Chrome tab for each site (`localhost:5173`, the live site). The app then remembers it there. E2E tests use a fake backend (`page.route`) and must never touch the real sheet.

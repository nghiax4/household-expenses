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
**Phase 4: rollout.** The site is live at https://nghiax4.github.io/household-expenses/ (public repo `nghiax4/household-expenses`, auto-deployed from `main`). The app covers the daily work: expense list, Add (equal, custom and % splits; templates), Mark who paid, edit and delete, settlements on a Settle up tab (closing is final; settled expenses stay locked), refusal of saves made on out-of-date data (with Show the latest), and a Notes tab. Every write is under the script lock with an Activity entry (notes excepted). `src/domain/` holds the money logic, fully unit-tested.

**sheet2 is imported (2026-11-23)** into a **fresh storage sheet** (ID in private notes; the old one, with only test data, is kept and renamed "TEST"). 49 expenses, added one at a time through the app's own requests and checked; count and total match sheet2. Nobody has created a settlement yet. The household hasn't been told yet.

**Tags: live since 2026-11-23.** Any expense can carry short tags; a tag equal to a template's name is a bill and shows in that bill's color. The real sheet got a Tags column (G, before Deleted at; person columns now start at I), after a backup copy. The 25 imported bills are tagged (Rent, Internet, Electricity, Insurance).

**Search box** on the Expenses list (Ctrl+F style, ignores accents): built and tested 2026-11-23, not pushed yet (front-end only; no backend or sheet change).

## Next steps
1. ~~Storage layout sign-off~~. **Layout 1 approved** on 2026-11-17 (sheet2-style: Expenses, Settlements, Templates, Activity, plus an **Ideas** tab added 2026-11-19). The schema is in `docs/requirements.md` → "Storage schema".
   - A sample storage sheet exists in the user's personal Drive (link and contents in private notes). The user wants to keep it until the real sheet exists.
   - The previous 7-tab design (View/People/Shares…) is superseded but recorded in `docs/decisions.md` in case the user wants to go back.
2. ~~Scaffold the project~~ (done 2026-11-19; layout in `docs/decisions.md` and CLAUDE.md). The core domain logic is done too.
3. ~~Publish + backend slice~~ (done 2026-11-19): repo, Pages, backend, storage sheet, passcode screen.
4. ~~Delete the two empty "Who" columns~~ (done 2026-11-20). The backup copy can be trashed once the user is happy (ask first).
5. Build the MVP features (see `docs/requirements.md`). ~~List expenses~~ and ~~add expense (equal split)~~ done 2026-11-21, ~~tried against the real sheet~~ 2026-11-22, ~~Paid toggles~~ and the loading spinner done 2026-11-22; ~~custom/% splits~~ done 2026-11-22. ~~templates~~ and ~~edit + delete~~ built 2026-11-22 (no trash screen, by the user's choice). ~~Settlements~~ and the bottom tab bar built 2026-11-22, live 2026-11-23 and tried on the iPhone; closing made final 2026-11-23; ~~Notes tab~~ (was "Ideas") built 2026-11-23. ~~Tags~~ and ~~search~~ built 2026-11-23. Next: "what I owe" → activity log, as real use shows what's needed. Every write needs an Activity entry (the lock already covers every request).
6. ~~Import sheet2~~ (done 2026-11-23, into a fresh storage sheet).
7. **Hand over to the household:** share the link and passcode. Before anyone taps Create on the first settlement, check its preview with the household (it nets every unpaid share since April; one person's amount is large; numbers in private notes).
8. Later, with the user's OK: trash the "TEST" storage sheet and the two backup copies (2026-11-20, and 2026-11-23 before the Tags column).

## Open questions
- None.

## Session log
<!-- Newest first. Keep the 5 most recent; move older entries to docs/session-history.md -->

### 2026-11-23, late night (search)
- The user asked for a Ctrl+F. A richer search ("unpaid", months, totals) was offered and declined as unclear; built the plain version: one box above the list, phrase match in description, note, tags, names and total, ignoring case and accents (`src/domain/search.ts`), with a count, an empty message and ✕.
- Checks: 283 unit and 54 e2e tests pass; iPhone screenshot.
- Not done: push (front-end only, so no ordering concerns).

### 2026-11-23, night (tags)
- The user wanted the template bills to stand out, then suggested tags on every expense. A subagent argued for deriving bills from descriptions instead; the user found that hacky and chose **general tags**.
- Built: `src/domain/tags.ts` (normalize, cell format, suggestions, bill lookup), Tags on `Expense`/`NewExpense`, a Tags column in the Expenses tab (person columns H → I; formatting constants and docs updated), Activity logs tags, `TagPicker` on the form (bills first, then tags in use; type a new one; a template sets its bill tag), `TagPill` on cards (bills colored, others gray outline).
- Checks: 269 unit and 52 e2e tests pass; iPhone screenshots of the form and list.
- Shipped: backup copy of the real sheet, inserted column G "Tags" in Chrome (formatting moved with the person columns), deployed the backend (version 10), pushed the site (`d8a4adc`). Live check: 49 expenses read with tags, no problems. Tagged the 25 imported bills through the app's Edit, each checked; checked the live list in Chrome.
- Not done: the user trying tags on the iPhone.

### 2026-11-23, evening (rollout: fresh sheet + sheet2 import)
- Session start: one open note ("Lol", the user's test).
- User's choices: a **fresh storage sheet** instead of deleting test rows; dateless rows take the row above's date; guests are covered by the payer (a "let a guest off" feature was discussed and dropped: Claude can fix such cases in the sheet when asked); the app's rounding (some debtors owe 1¢ less than sheet2 displayed); import **row by row through the app's own requests** rather than new import code.
- Read sheet2 in full (read-only, also in formula view at the user's request: per-person cells are total ÷ a typed headcount, which settled the 3 odd rows).
- In Chrome: renamed the old storage sheet "TEST - …", removed the SPREADSHEET_ID script property, ran setupStorage (new sheet), typed the 4 templates. The backend reads them exactly as before.
- Added the 49 expenses one at a time (addExpense, then setShareStatuses for the 24 shares already paid back), each read back and checked; then the whole sheet matched the plan exactly and the total matched sheet2. Live app checked in Chrome.
- Not done: telling the household; reviewing the first settlement with them; trashing the TEST sheet (later, ask first).

### 2026-11-23, later (Notes tab)
- The user chose to build the jotting-down feature before the sheet2 import. It's not for "ideas" but for cases the app didn't handle, to discuss with Claude; the user wanted the minimum ("something typeable").
- Built a **Notes** tab (third in the bottom bar): a text box + Add note, the Open notes newest first, each with Done. Stored in the existing Ideas tab (new backend actions `addNote` and `closeNote`; `apps-script/src/notesTab.ts`). No Activity entries, no out-of-date check (adding never clashes; Done is idempotent).
- Checks: 263 unit and 52 e2e tests pass; iPhone screenshot checked.
- Shipped: backend first (version 9; a live `listExpenses` returns `notes: []`), then the site (the new site expects `notes` in the data; the old site ignores it).
- The user likes the Notes tab and thinks the app is about ready to be put into use; **next session: talk about rollout** (clearing the test rows, the sheet2 import and its no-date rows, telling the household).

### 2026-11-23 (settlements live; closing made final)
- Went live: "Cancelled at" header added to the real sheet, backend redeployed, site pushed (`6901b73`), Claude in Chrome check of the live preview.
- The user tried it on the iPhone and found a hole: after settlement #2 closed, Mark who paid could set a settled share back to Not paid, so the sheet contradicted itself and the next settlement would charge it again.
- User's choice: **closing is final**. The earliest pending or closed settlement covering an expense locks it (`coveringSettlement`); closed ones for good. Cards say "Paid off in settlement #K."; the backend refuses Mark who paid / edit / delete with "…was paid off in settlement #K, so it can't be changed anymore. If something about it is wrong, fix it in the sheet." The close warning now says it's final. Known gap: "Mark all paid" (shares cancel out) stores no settlement, so those expenses aren't locked.
- User feedback: replies were too long; explain designs as app behavior, not code.
- Audit for nonsensical states (4 subagents: settlements, concurrency, single expense, sheet hand edits). Root causes found: (1) a Paid share survives edits that change its amount, payer or people, and deletes drop paid money → proposed: no edit/delete while anyone has paid back; (2) stale phones overwrite newer changes (edit, Mark who paid, a tick that closes a settlement without the warning) and refused saves leave the screen stale → **built** (the only one the user wanted fixed): each change carries what the phone saw (`seen`), refused if the expense or settlement changed at all; a failed save shows **Show the latest** (the user asked for a tap rather than an automatic refresh, so the screen doesn't change before they read why); the cancel-confirm box got its React key; (3) hand edits can reuse an expense ID inside a settlement's range or close a settlement without paying its shares → proposed: new IDs always above every settlement's range, and an unpaid share inside a closed settlement is flagged as a sheet problem; (4) small: cancel-confirm box can carry over to a new settlement (no React key), payer's share Not paid by hand isn't flagged. The user accepted the rest as fine for the app's simplicity; they'll jot weird cases in the Ideas tab and bring them to Claude. Also left: duplicate add after a 60 s timeout (Show the latest now lets them check), sheet locale, date range, "1,2,3" amount parsing.
- Shipped both (site `0fcb20f`, then backend version 8). Live checks with direct calls that write nothing: a wrong `seen` is refused ("changed on another device"), and the right one on test expense #1 gets "paid off in settlement #2". A first check looked like a backend bug, so the backend was rolled back to version 7 for a few minutes; the real cause was the test itself (Python on Windows mangled the Vietnamese names; fixed with `PYTHONUTF8=1`, now noted in CLAUDE.md). Right after a redeploy, Google can serve the old version for up to a minute.
- The user tried the two-device Mark who paid test on the live app (iPhone + laptop): it works. The stale Edit case wasn't tried by hand (covered by a backend unit test only).
- Not done: clearing the test rows before the import.

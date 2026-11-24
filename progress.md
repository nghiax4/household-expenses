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

## Next steps
1. ~~Storage layout sign-off~~. **Layout 1 approved** on 2026-11-17 (sheet2-style: Expenses, Settlements, Templates, Activity, plus an **Ideas** tab added 2026-11-19). The schema is in `docs/requirements.md` → "Storage schema".
   - A sample storage sheet exists in the user's personal Drive (link and contents in private notes). The user wants to keep it until the real sheet exists.
   - The previous 7-tab design (View/People/Shares…) is superseded but recorded in `docs/decisions.md` in case the user wants to go back.
2. ~~Scaffold the project~~ (done 2026-11-19; layout in `docs/decisions.md` and CLAUDE.md). The core domain logic is done too.
3. ~~Publish + backend slice~~ (done 2026-11-19): repo, Pages, backend, storage sheet, passcode screen.
4. ~~Delete the two empty "Who" columns~~ (done 2026-11-20). The backup copy can be trashed once the user is happy (ask first).
5. Build the MVP features (see `docs/requirements.md`). ~~List expenses~~ and ~~add expense (equal split)~~ done 2026-11-21, ~~tried against the real sheet~~ 2026-11-22, ~~Paid toggles~~ and the loading spinner done 2026-11-22; ~~custom/% splits~~ done 2026-11-22. ~~templates~~ and ~~edit + delete~~ built 2026-11-22 (no trash screen, by the user's choice). ~~Settlements~~ and the bottom tab bar built 2026-11-22, live 2026-11-23 and tried on the iPhone; closing made final 2026-11-23; ~~Notes tab~~ (was "Ideas") built 2026-11-23. Next: "what I owe" → activity log → search/filter, as real use shows what's needed. Every write needs an Activity entry (the lock already covers every request).
6. ~~Import sheet2~~ (done 2026-11-23, into a fresh storage sheet).
7. **Hand over to the household:** share the link and passcode. Before anyone taps Create on the first settlement, check its preview with the household (it nets every unpaid share since April; one person's amount is large; numbers in private notes).
8. Later, with the user's OK: trash the "TEST" storage sheet and the 2026-11-20 backup copy.

## Open questions
- None.

## Session log
<!-- Newest first. Keep the 5 most recent; move older entries to docs/session-history.md -->

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

### 2026-11-22, later (settlements)
- Session start: no notes in the Ideas tab. Real sheet: only test expense #1 ($2.02, not deleted); Settlements empty.
- The user left the session's focus to Claude: **settlements**. User's picks: bottom tab bar, preview before Create, cancel only while no transfer is ticked.
- Built: domain rules in `src/domain/settlement.ts` (`proposeSettlement`, `settlementState`, `lockingSettlement` (now `coveringSettlement`), `withTransferStatuses`, `paidOffExpenses`); backend `apps-script/src/settlementsTab.ts` plus actions `createSettlement`, `setTransferStatuses` (ticking the last line closes it and marks every covered share Paid) and `cancelSettlement`; edit, delete and Mark who paid refuse locked expenses. Request parsing moved to `parseRequest.ts`, cell helpers to `cells.ts`. UI: `UnlockedApp` (loads once, keeps both screens mounted), `TabBar`, `SettleScreen`, `SettlementPreview`, `TransfersDialog`, a shared `Dialog` shell; locked cards say "In settlement #K…". New Settlements column **Cancelled at**.
- Fixed in passing: the "it may still have saved" timeout message now covers every write (edit and delete were missing).
- Checks: 246 unit and 44 e2e tests pass (typecheck, lint, format too). iPhone (WebKit) and desktop Chrome screenshots of every settlement state checked with made-up data, via Playwright (the real backend doesn't have the new actions yet, so no Claude in Chrome check against it).
- Went live (next day, see 2026-11-23): added the "Cancelled at" header to the real sheet's Settlements tab (I1, styled like the others), redeployed the backend (checked with a direct `listExpenses` call), committed and pushed. Claude in Chrome check of the live site: tab bar, Settle up screen and the preview for test expense #1 (3 transfers, $2.02 in all) correct, no console errors; closed without creating.

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
- Built **edit and delete**: an Edit button on each card opens the shared form (`AddExpenseForm.tsx` renamed `ExpenseForm.tsx`), prefilled, with Delete expense at the bottom (asks first). Edits keep who had paid back (`carryOverStatuses`); deletes only fill in "Deleted at" (the user didn't want a trash screen; the row stays so IDs are never reused). New backend actions `editExpense` / `deleteExpense`, each logged to Activity with full details; storage gained `setRow`. 209 unit and 34 e2e tests pass; iPhone screenshots checked; backend redeployed. The user tried it on their iPhone: the edit of test expense #1 ($1.01 → $2.02) is correct in the real sheet; delete was not yet tried there (checked live: #1 still not deleted). Committed and pushed (user's OK).

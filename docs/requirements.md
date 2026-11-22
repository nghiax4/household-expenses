# Requirements: Household Shared-Expense App

Replaces tab **sheet2** of the household's Google Sheet. (Real names, amounts and links are in the git-ignored `docs/private-notes.md`; this file stays neutral because the repo is public.) Status: **MVP spec, agreed 2026-11-16.** See "Architecture" below; the stack is in `docs/decisions.md`.

## Access
- A single shared link with **no user accounts**, protected by one **household passcode** that each device enters once.
- **Every phone gets the same UI.** There's no "who are you" step and no per-device name, so the app doesn't record who made a change (decided 2026-11-20).
- **Mobile-first.** Adding an expense on a phone right after paying must be fast. That's the main pain point with sheet2.
- **Everyone uses an iPhone**, so the app must work well in Safari (WebKit), including Add to Home Screen. Android doesn't need special attention.
- **English UI.** Descriptions and names can be in any language (Vietnamese diacritics must display correctly).
- **Typing uses the iPhone keyboard** (revised 2026-11-20). See "Input" below.

## Input (revised 2026-11-20)
- **Text** (description, note, Ideas, template names, new people, search): normal text boxes with the **iPhone keyboard**. Vietnamese comes from the phone's own Vietnamese keyboard (Telex or VNI, set up in iOS Settings), and paste, autocorrect and dictation work.
  - Text in a text box is **at least 16px**; smaller text makes Safari zoom the page in when the box is tapped.
- **Numbers** (passcode, total, custom split amounts, percentages): text boxes that ask for the **iPhone's number keypad**: the digit keypad (`inputmode="numeric"`) for the passcode, the keypad with a `.` (`inputmode="decimal"`) for amounts and percentages. These keypads have no Done key, so tapping elsewhere closes them. The passcode box keeps only digits as you type; amounts are checked when saving (a number, more than $0.00, at most 2 decimals) with a clear message instead of blocking keys.
- **Date:** defaults to today, with **Today / Yesterday** buttons and the **iPhone's date picker** for older dates (also used by the date-range filter).
- **Description shortcut:** recently used descriptions appear as **tap-to-fill chips**, so common expenses need no typing.
- History: on 2026-11-20 the app briefly had its own letter keyboard with Vietnamese Telex, because the iPhone keyboard had felt slow. The user tried both on their phone and preferred the iPhone keyboard (the slow feel was likely Safari's page zoom being at 50%). The custom keyboard was removed before it was ever committed.

## People
- Starts with the 7 people from sheet2 (4 roommates plus 3 occasional; names in private notes). Names may contain Vietnamese diacritics.
- New people can be added anytime (this replaces sheet2's "Extra people" column). In storage, each person is a column in Expenses. Adding a person appends a column and fills it with "Not involved" on every existing expense row.

## Expenses
- Fields: **description, date, total, payer, participants + split, note**.
- Split types:
  - **Equal** among the selected participants (the default, matching sheet2).
  - **Custom amounts** per person (must sum to the total).
  - **Percentages** per person (must sum to 100%, up to two decimals, e.g., 33.33%). Percentages are an **input method only**: the resulting dollar amounts are stored, so editing the expense later shows amounts, not percentages. Each share rounds down to the cent, and the leftover cents follow the equal-split rule below.
  - The split type isn't stored. When editing, the app shows "equal" if the amounts match an equal split, otherwise custom amounts.
- Store all money as **integer cents**. Shares must always add up exactly to the total, and every share must be more than $0.00 (someone with nothing to pay is "Not involved"). In an equal split, the **payer absorbs the leftover cents** (e.g., $139.61 / 4 → payer $34.91, the others $34.90). If the payer isn't a participant, the leftover cents go to participants in person-column order (left to right in Expenses).
- Each participant's share is **Not paid** or **Paid**. These are the only two share statuses, both in storage and on screen.
  - The payer's own share is automatically Paid.
  - Anyone can mark a share Paid when that person pays it back individually (as in sheet2 today).
- Everyone who isn't a participant is shown as **Not involved** (as in sheet2), both in storage and on screen. It's not a share status: there's no amount and nothing to pay.
- Dropped from sheet2: the "Zelle vào" column (unused) and "Extra people" (replaced by adding people).

### Expense list and Add form (built 2026-11-21)
- **List:** live expenses (trash hidden), latest date first; same-day expenses newest-added first. Each card shows description, total, date, payer, the note if any, and a chip per participant: red "Name $x" while Not paid, green "✓ Name $x" once Paid. Not-involved people get no chip.
- **Rows the backend can't read** (bad hand edits) are left out of the list, and a yellow box at the top names each one by sheet row number with what's wrong, so it can be fixed in the sheet.
- **Add form** (equal split only so far): Description (with up to 6 recent-description chips), Total, Date (Today / Yesterday / date picker, default today), Paid by (pick one), Split equally between (pick any), Note. **Nothing is pre-selected** for payer or participants, so a wrong default can't slip through unnoticed. Once the total, payer and people are set, the form previews each person's share with the same chips as the list.
- The payer **doesn't have to be in the split** (e.g., buying something only for others; they're owed the full total). It's easy to do by a missed tap, so the form then says so under the preview: "Anh isn't in the split, so Anh is owed the full $1.01." (Confirmed with the user 2026-11-22.)
- Problems are explained one at a time on Save, in form order; the backend re-checks everything. While saving, the buttons are disabled so a double tap can't add the expense twice.
- If a saved passcode stops working (it was changed), the app forgets it and asks again.

### Marking shares paid (built 2026-11-22)
- The chips on a card are plain (not tappable). Below them, a **Mark who paid** button opens a checklist: "Who has paid back for "Internet"?". Each participant has a row with a checkbox, their chip (red/green, following the tick) and "Paid back" / "Not paid". The payer's row has no checkbox and says **"Paid the bill"**: their share counts as settled because they fronted the whole bill. The button is hidden when the payer is the only one in the split.
- Nothing is saved until **Save** (Cancel discards), so a stray tick can be undone. Several people can be marked in one Save. Unticking a green row sets it back to Not paid.
- Screen words vs storage: "Paid back" and "Paid the bill" are only on screen; the sheet keeps "Paid" / "Not paid".
- The app sends only the shares that changed, each with its **new status** (not "toggle"), so a phone showing an old list can't flip a share back or overwrite another phone's change to someone else. Shares already at that status are neither written nor logged.
- The backend checks every change before writing any, and refuses the whole Save for the payer's share, someone not involved, an expense in the trash, an ID it can't find, an ID on two rows, or a row it can't read. Otherwise it rewrites each changed person cell, adds one Activity row per person (`Marked paid` / `Marked not paid`, e.g. `#2 "Internet": Chi $10.00, Not paid → Paid.`), and returns the tab read back.
- Still to come with settlements: refuse shares locked by a pending settlement ("covered by settlement #K").

## Quick-add templates (recurring bills)
- Saved presets: name, payer, participants, plus an optional default amount. **Templates always split equally** (MVP). The user can switch to a custom or percentage split on the pre-filled form before saving.
- Templates are created and edited in the app. They don't affect balances.
- Examples: rent, Internet, electricity, insurance, each split among the 4 roommates (payers and amounts in private notes).
- Using a template pre-fills everything, so the user only confirms or types the amount and date.

## Ideas (notes on undecided changes to the app)
- A simple inbox for ideas about the app itself, e.g., "need a way to split tips" or "not sure templates are still useful". The point is to write a thought down on the phone right away, then discuss it later with Claude Code on the laptop and change the app.
- **Anyone** can add a note: one free-text box plus an Add button. The app fills in the time automatically.
- Each note has a **Status**: Open (new), Done (acted on) or Dropped (decided against), plus an optional one-line **Outcome** (e.g., "Added in the Feb update" or "Not needed: use templates"). Anyone can edit a note's text, status and outcome. There's no delete: Dropped plays that role and keeps the history.
- The list shows Open notes first (newest first), then Done and Dropped.
- Ideas don't touch money, so they're not written to the Activity log. The row itself records when the note was added.
- **Claude Code pickup:** at the start of each session, Claude reads the Ideas tab through the Google Drive connector and lists the Open notes. After a note is discussed, the user (or Claude in Chrome, if asked) sets its Status and Outcome.

## Settlements ("Get total settlement")
1. Anyone taps **Get total settlement**.
2. The app gathers every share that's still **Not paid** on expenses up to the latest expense ID (call it N). Shares already marked Paid individually are skipped. The settlement records **"covers up to expense #N"**.
3. It computes each person's net balance and the **minimum number of transfers** to settle everyone.
   - Algorithm: bitmask DP. Min transfers = (number of people with a nonzero balance) − (max number of disjoint zero-sum subsets). With 7 or fewer people this is trivial.
4. The settlement is **frozen** at that moment. While it's pending, expenses #1 to #N are **locked**: their Not-paid shares still show as **Not paid** but can't be marked Paid individually (that would double-count with the settlement transfer), and those expenses can't be edited or deleted (that would change amounts the settlement already computed). Tapping one in the app explains "covered by settlement #K". Expenses added afterward get IDs above N and go into the next period.
5. Each transfer line (e.g., "Bảo → Anh $81.24") has its own **Paid** checkbox.
6. When **all lines are checked**, the settlement closes and every Not-paid share on expenses #1 to #N flips to **Paid**. That's a clean slate.
7. Past settlements stay viewable in history.
- Known limitation (MVP): partial repayment of a single share isn't tracked. Leftover debt rolls into the next settlement.

## Views
- **Expense list** (newest first) with **search and filters**: by person, payer, date range, keyword.
- **"What I owe / am owed" view**: pick a person from a list on that screen to see their unpaid shares and running totals.
- **Settlements**: the current pending settlement (with its checkboxes) plus history.
- **Activity log**: what changed and when, e.g., `Edited "Grocery delivery": $44.27 → $42.27`. It doesn't say who.
- **Ideas**: add a note, and see or update the list (see "Ideas" above).

## Safety
- **Activity log** of every create, edit, delete, status change and settlement action on expenses, templates and people. Ideas are the exception (see "Ideas").
- **Trash with restore** for deleted expenses (soft delete).

## Data migration
- **Import all sheet2 rows** at launch, read from the live sheet at that time (the user corrects data in the sheet, e.g., rows 22, 23 and 25 on 2026-11-16).
- Mapping: Người đóng → payer. Each person column: Paid → Paid, Not paid → Not paid, Not involved → Not involved (not a participant). Equal split. Note → note.
- Some rows have no date (examples in private notes). Ask the user how to handle them at import time.

## Architecture (decided 2026-11-16)
- **Guiding principle:** the storage sheet should read as much like the app as possible: same names, same statuses, same shape where feasible. Any difference must have a concrete reason.
- **Frontend:** a static site on a free host (e.g., GitHub Pages), mobile-first, installable to the Home Screen. Its code lives in this repo.
- **Backend:** a Google Apps Script web app that runs as the owner. It checks the passcode on every request and uses `LockService` so requests run one at a time (two phones saving at once can't take the same expense ID). The app sends JSON as `text/plain` POST requests. Every write also appends an Activity row, then the backend reads the tab back and returns it, so the app shows exactly what was stored.
- **Storage:** a **new private Google Sheet** in the user's **personal Gmail** account (not the current household sheet, which is shared by link). Only the owner has access.
  - Keys: a person's **full name**; **sequential integer IDs** for expenses and settlements.
  - Storage tabs are protected with a warning. Hand edits are for emergencies only, and the backend validates data on read.
  - Money is stored in the sheet as dollars with 2 decimals (readable) and converted to integer cents in code.
  - The backend reads cells **as the sheet displays them** and writes: Date as a real date shown `yyyy-mm-dd`, Total as a number shown `$#,##0.00`, ID as a number, and all other text as literal text (a hidden leading apostrophe, so "1/2" doesn't become a date and "=…" doesn't become a formula).
- Expect about 0.5–2 seconds per save or load. That's acceptable for this use.
- **While waiting** (loading the list, checking the passcode, any Save), the app shows a spinning circle with what it's doing ("Saving…"), and from 3 seconds on, how long it's been ("Saving… 5s"). A real progress bar isn't possible: the backend sends one answer at the end and nothing in between.
- **The app gives up after 60 seconds** without an answer (added 2026-11-22). Without that, a hung request would wait until Safari or Google gave up, anywhere from about 1 to 6 minutes. For a save, the message warns that it may still have saved and to check the list before retrying, because a blind retry could add the same expense twice. (The backend itself waits up to 30 seconds for its turn behind another phone's request, and Google stops any script after 6 minutes.)

### Storage schema: "layout 1", sheet2-style, 5 tabs (approved by the user 2026-11-17; Ideas tab added 2026-11-19)
| Tab | Columns | Notes |
|---|---|---|
| **Expenses** | ID, Date, Description, Total, Payer, Note, Deleted at, then **one column per person** | Looks like sheet2 and the app. A person cell is `"$12.34 · Not paid"`, `"$12.34 · Paid"`, or `"Not involved"`. It's never blank on an expense row. People columns come last so adding a person appends a column (filled with "Not involved" on existing rows). A non-empty "Deleted at" means it's in the trash. The history of changes to an expense lives only in Activity. |
| **Settlements** | Settlement ID, Created at, Covers up to expense #, From, To, Amount, Paid, Paid at | One row per transfer line. A settlement is closed when all its lines are Paid (derived, not stored). |
| **Templates** | Name, Payer, Participants (comma-separated names), Default amount | Equal split only. Starting set: the 4 recurring bills (rent, Internet, electricity, insurance), all for the 4 roommates (details in private notes). |
| **Activity** | Time, Action, Details | Append-only. |
| **Ideas** | ID, Created at, Note, Status, Outcome | One row per note, with a sequential integer ID. Status is `Open`, `Done` or `Dropped`: a dropdown on D2:D1000 that rejects any other value, shown as plain text so empty rows stay clean. Outcome is optional. Rows are never deleted. |

Formatting on the Expenses person columns (H2:Z1000), set up by the setup script through Apps Script:
- Conditional formatting (custom formulas, in this order):
  - `ISNUMBER(SEARCH(" · Not paid", H2))`: dark red (#C00000) fill, white text.
  - `ISNUMBER(SEARCH(" · Paid", H2))`: light green (#D9EAD3) fill.
  - `EXACT(H2, "Not involved")`: gray (#808080) text, no fill.
  - `AND($A2<>"", H$1<>"", H2="")`: yellow (#FFE599) fill. This flags a missing cell on an expense row, because data validation never checks empty cells.
- Data validation, "show warning" (doesn't block): `=IF(OR($A2="", H$1=""), H2="", OR(EXACT(H2, "Not involved"), REGEXMATCH(H2, "^\$[0-9,]+\.[0-9]{2} · (Paid|Not paid)$")))`. Outside expense rows and person columns, a cell must be empty. `EXACT` is needed because `=` ignores case in Sheets. `REGEXMATCH` doesn't survive an xlsx import, so it must be created in Sheets.
- Tested 2026-11-17 in the sample: valid cells show no flag; lowercase "not involved" and junk text in an empty row get the "Invalid" flag; a blank cell on an expense row turns yellow.
- The backend parses person cells with the same rules (exact text, case-sensitive) and reports any cell that doesn't match, including a blank one on an expense row, instead of guessing.

## Out of scope for MVP
- Receipt photos, spending charts and categories, notifications, multiple currencies, user accounts.

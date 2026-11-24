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
- **List:** live expenses (deleted ones hidden), latest date first; same-day expenses newest-added first. Each card shows description, total, date, payer, the note if any, and a chip per participant: red "Name $x" while Not paid, green "✓ Name $x" once Paid. Not-involved people get no chip.
- **Rows the backend can't read** (bad hand edits) are left out of the list, and a yellow box at the top names each one by sheet row number with what's wrong, so it can be fixed in the sheet.
- **Add form**: Description (with up to 6 recent-description chips), Total, Date (Today / Yesterday / date picker, default today), Paid by (pick one), Split (how, and between whom), Note. **Nothing is pre-selected** for payer or participants, so a wrong default can't slip through unnoticed. Once the total, payer and people are set, the form previews each person's share with the same chips as the list.
- The payer **doesn't have to be in the split** (e.g., buying something only for others; they're owed the full total). It's easy to do by a missed tap, so the form then says so under the preview: "Anh isn't in the split, so Anh is owed the full $1.01." (Confirmed with the user 2026-11-22.)
- **Split types** (built 2026-11-22): a 3-way switch **Equally / Amounts / Percent** above the people pills. With Amounts or Percent, each picked person gets a box (decimal keypad), in column order. Numbers in the boxes are **left-aligned**, so a tap on the empty part lands the cursor after the number (the keypad has no arrow keys; right-aligned numbers put it in front). Switching starts the boxes at the **equal split** (e.g. $5.00 / $5.00, or 33.34% / 33.33% / 33.33% with the payer taking the extra hundredth), so only the differences need typing; someone picked afterwards starts with an empty box. A live line under the boxes says "$1.00 left to split", "20% too much" or "✓ Adds up to $10.00". Percent mode also previews each share in dollars with chips. Percentages take up to 2 decimals, more than 0% and at most 100%.
- Problems are explained one at a time on Save, in form order; the backend re-checks everything. While saving, the buttons are disabled so a double tap can't add the expense twice.
- If a saved passcode stops working (it was changed), the app forgets it and asks again.

### Editing and deleting (built 2026-11-22)
- Each card has an **Edit** button next to "Mark who paid". It opens the same form as Add, filled in with the expense as stored and titled "Edit expense". The split opens as "Equally" when the amounts are exactly an equal split, otherwise as typed Amounts. Quick fill isn't shown (it would overwrite the expense).
- **Who had paid back is kept** through an edit: each person still sharing (who wasn't the payer) keeps Paid or Not paid, even if their amount changed; people added start Not paid; the payer is always Paid, so an old payer who stays in the split now owes their share. The Activity entry lists exactly what changed, e.g. `#2 "Internet": Total $40.00 → $48.00; Chi $10.00 · Not paid → $12.00 · Not paid.` Saving unchanged writes and logs nothing.
- **Delete expense** at the bottom of the edit form asks first ("Delete "Groceries"? It disappears from the app for everyone, and the app can't bring it back." Keep it / Delete). See Safety for what a delete does in the sheet.
- The backend refuses to edit, delete or mark a deleted expense, and checks the same rules as Add.

### Marking shares paid (built 2026-11-22)
- The chips on a card are plain (not tappable). Below them, a **Mark who paid** button opens a checklist: "Who has paid back for "Internet"?". Each participant has a row with a checkbox, their chip (red/green, following the tick) and "Paid back" / "Not paid". The payer's row has no checkbox and says **"Paid the bill"**: their share counts as settled because they fronted the whole bill. The button is hidden when the payer is the only one in the split.
- Nothing is saved until **Save** (Cancel discards), so a stray tick can be undone. Several people can be marked in one Save. Unticking a green row sets it back to Not paid.
- Screen words vs storage: "Paid back" and "Paid the bill" are only on screen; the sheet keeps "Paid" / "Not paid".
- The app sends only the shares that changed, each with its **new status** (not "toggle"), so a retried Save changes nothing. Shares already at that status are neither written nor logged.
- **Phones showing old data** (user's request, 2026-11-23): every change to an existing expense or settlement (Mark who paid, edit, delete, ticking transfers, cancel) also sends that expense or settlement **as the phone showed it**. If the sheet now holds anything different (another phone changed it, even a different person's tick), the backend refuses and saves nothing: `"Groceries" was changed on another device since you opened this, so nothing was saved.` Creating a settlement already works this way (the preview must still match).
- **Every failed save shows a Show the latest button** under the reason. The screen doesn't change by itself (user's choice: refreshing unasked would confuse); tapping it reads the sheet fresh, closes what was open, and shows the latest. This also answers a timeout's "it may still have saved".
- The backend checks every change before writing any, and refuses the whole Save for the payer's share, someone not involved, a deleted expense, an ID it can't find, an ID on two rows, or a row it can't read. Otherwise it rewrites each changed person cell, adds one Activity row per person (`Marked paid` / `Marked not paid`, e.g. `#2 "Internet": Chi $10.00, Not paid → Paid.`), and returns the tab read back.
- Shares on expenses covered by a pending or closed settlement are locked (see Settlements): the card shows no Mark who paid / Edit buttons, and the backend refuses them too.

## Quick-add templates (recurring bills) (built 2026-11-22)
- Presets: name, payer, participants, plus an optional default amount. **Templates always split equally.** They don't affect balances.
- **Edited only in the sheet's Templates tab** (decided 2026-11-22, the user's idea): templates change maybe once a year, so a screen for them isn't worth it. Claude makes the edits (in Chrome, at the user's request), so mistakes get caught. The app only reads them. Columns: Name, Payer, Participants (names separated by commas), Default amount (optional; typed like 25 or 12.50). Stray spaces are forgiven; names must match a person column exactly.
- A row the app can't read (unknown name, bad amount, a name used twice) is skipped and explained in a yellow box on the Add form, like broken expense rows. A changed header skips all templates. The rest of the app keeps working either way.
- **Using one:** a **Quick fill** row of buttons at the top of the Add form. Tapping one fills the description (the template's name), payer, people (equal split) and the default amount; with no default (rent, electricity) the Total box is left empty. The keypad doesn't open on its own (it did at first; the user found it annoying). Everything stays editable, including switching to Amounts or Percent, before Save.
- Starting set (added 2026-11-22, English names): Rent, Internet, Electricity, Insurance, all for the 4 roommates (payers and amounts in private notes; rent has no default).

## Tags (built 2026-11-23)
- The user's idea: make the recurring bills stand out in the list. They chose **general tags** over a single "bill" field and over guessing from the description (which they found hacky).
- Any expense can have **0+ short tags** (e.g. Rent, Groceries, Rides), shown as small pills under the date line. Tags are trimmed, can't contain a comma (the sheet keeps them comma-separated in the Tags cell) and are at most 30 characters; "rent" and "Rent" count as the same tag (the existing spelling wins).
- **Bills stand out:** a tag equal to a template's name (ignoring case) is a solid pill in that bill's own color (by Templates-tab order; no red or green, which mean Not paid / Paid). Other tags are quiet gray outlines.
- **Add/Edit form:** a Tags section with the bills first, then the tags in use (most used first), tap to add or remove; plus a "New tag" box (Enter or Add tag). Picking a template adds its name as a tag, replacing another template's tag (like everything else a template fills in) and keeping ordinary tags.
- Tags change only through Edit, so an expense locked by a settlement can't be re-tagged. Edits log tag changes in Activity ("Tags (none) → Rent"); new expenses list their tags.

## Notes (built 2026-11-23; stored in the Ideas tab)
- A place to jot down, on the spot, a case the app didn't handle (e.g., "rent was split 5 ways this month because a guest stayed"), to talk through with Claude Code later and change the app. The user asked for the minimum: something to type into (2026-11-23).
- A **Notes** tab in the bottom bar: a text box (line breaks kept) and **Add note**. Anyone can add one; the app fills in the time and saves it as Open. A half-typed note survives switching tabs.
- Below, the **Open notes, newest first**, each with its date and a **Done** button that sets its Status to Done (it disappears from the list; the row stays in the sheet). Done and Dropped notes aren't shown. There's no editing or deleting in the app.
- Notes don't touch money, so they're not written to the Activity log and need no out-of-date check: adding never clashes, and Done on a note that's already closed changes nothing.
- Unreadable Ideas rows are skipped and listed on the Notes screen (like Templates), never failing the app.
- **Claude Code pickup:** at the start of each session, Claude reads the Ideas tab through the Google Drive connector and lists the Open notes. Afterwards the user taps Done, or Claude sets Status (Done or Dropped) and Outcome in Chrome if asked.

## Settlements ("Get total settlement") (built 2026-11-22)
1. Anyone taps **Get total settlement** on the **Settle up** screen. The app reads the sheet fresh and shows a **preview** first (the transfers, "the 9 unpaid shares on 4 expenses", and that those expenses get locked); nothing is saved until **Create** (user's choice, 2026-11-22). The backend recomputes and refuses if the result no longer matches the preview (another phone saved in between), so what's saved is what was shown. It also refuses while any Expenses row is unreadable (the settlement could miss what it owes), while another settlement is pending, or when nothing is unpaid ("Nothing to settle").
2. The app gathers every share that's still **Not paid** on expenses up to the latest expense ID (call it N). Shares already marked Paid individually are skipped. The settlement records **"covers up to expense #N"**.
3. It computes each person's net balance and the **minimum number of transfers** to settle everyone.
   - Algorithm: bitmask DP. Min transfers = (number of people with a nonzero balance) − (max number of disjoint zero-sum subsets). With 7 or fewer people this is trivial.
4. The settlement is **frozen** at that moment. While it's pending, expenses #1 to #N are **locked**: their Not-paid shares still show as **Not paid** but can't be marked Paid individually (that would double-count with the settlement transfer), and those expenses can't be edited or deleted (that would change amounts the settlement already computed). Their cards show "In settlement #K, so it can't be changed (see Settle up)" instead of the buttons. Expenses added afterward get IDs above N and go into the next period (adding still works while one is pending).
5. Each transfer line (e.g., "Bảo → Anh $81.24", red until paid, green with ✓ after) is ticked off in a **Mark transfers paid** checklist with one Save, like Mark who paid. Unticking is allowed while the settlement is pending. Only changed lines are sent, as new statuses.
6. When **all lines are checked**, the settlement closes (the checklist warns before Save) and every Not-paid share on expenses #1 to #N flips to **Paid** in the same request. That's a clean slate. **Closing is final** (user's choice, 2026-11-23): a closed settlement can't be changed, and expenses #1 to #N **stay locked for good** (cards say "Paid off in settlement #K."; the backend refuses Mark who paid, edit and delete), so nobody can un-pay a share or change an amount money already moved for. The close warning says it's final. A mistake in a settled expense is fixed by hand in the sheet (by the user or Claude). An expense is locked by the earliest pending or closed settlement that covers it; cancelled ones lock nothing.
7. Past settlements (newest first, "Paid off Nov 2" or "Cancelled Nov 10") stay viewable on the Settle up screen.
8. **Cancel settlement** (user's choice, 2026-11-22): allowed only while **no line is ticked** (money that already moved would be hidden otherwise; untick first). It asks first, fills in "Cancelled at" on its rows (they stay, so IDs are never reused), logs it, and unlocks the expenses. Cancelled transfers show in gray.
9. If the unpaid shares **cancel each other out** (nobody needs to send money), the preview says so and offers **Mark all paid**, which flips those shares to Paid right away without saving a settlement (a settlement with no transfer lines can't be stored as rows). Since nothing is stored, those expenses don't get the permanent lock (known gap; it needs the unpaid shares to cancel out exactly, so it should be rare).
- Activity entries: Created settlement, Marked transfer paid / not paid, Closed settlement (lists every share it marked Paid), Cancelled settlement, Settled without transfers.
- Known limitation (MVP): partial repayment of a single share isn't tracked. Leftover debt rolls into the next settlement.

## Views
- **Navigation** (built 2026-11-22, user's choice): a **bottom tab bar** fixed at the bottom of the screen, like most iPhone apps (Expenses, Settle up, Notes; Activity and What I owe will join it, five at most). Switching tabs keeps each screen's state, so a half-typed expense survives a look at Settle up. Dialogs cover the bar.
- **Expense list** (newest first) with a **search box** (built 2026-11-23, the user's "Ctrl+F"): above the list, filtering as you type. It matches the typed text anywhere in an expense's description, note, tags, payer's or a participant's name, or total ("40" finds $40.00), ignoring case and Vietnamese accents ("tien dien" finds "Tiền điện"). Shows "3 of 49 expenses", "No expenses match …" and an ✕ to clear. The search stays while the Add/Edit form is open. (A richer version with "unpaid" and month words was offered and declined as unclear.) Filters by date range are not built.
- **Views** (built 2026-11-24, the user's idea, to see more at once): a **Cards | Compact | Table** switch above the list, remembered per device (local storage). Every view groups expenses under **month headings** ("November 2026 · 18 expenses · $3,450.31") that fold away with a tap (not while searching, so a match is never hidden). **Compact**: one row per expense with date, description, tags, total, and "3 owe" / "✓ All paid" / "✓ Paid off". **Table**: like the sheet, a column per person with red/green amounts; it scrolls sideways on a phone with the expense column fixed. Tapping a compact or table row opens the full card in a dialog, with Mark who paid and Edit.
- **"What I owe / am owed" view**: pick a person from a list on that screen to see their unpaid shares and running totals.
- **Settle up** (built 2026-11-22): Get total settlement, or the pending settlement with its transfers, plus history. See "Settlements".
- **Activity log**: what changed and when, e.g., `Edited "Grocery delivery": $44.27 → $42.27`. It doesn't say who.
- **Notes** (built 2026-11-23): jot down a case the app didn't handle; see "Notes" above.

## Safety
- **Activity log** of every create, edit, delete, status change and settlement action on expenses, templates and people. Notes are the exception (see "Notes").
- **Delete without a trash screen** (decided 2026-11-22: "we'll never need it"). A delete only fills in the row's "Deleted at" cell; the row stays in the sheet, hidden from the app. Expense IDs are never reused (settlements rely on that), and a mistaken delete can be undone by hand by clearing that cell (Claude, when asked). The Activity entry lists every cell, so the row could even be rebuilt from the log.

## Data migration
- **Import all sheet2 rows** at launch, read from the live sheet at that time (the user corrects data in the sheet, e.g., rows 22, 23 and 25 on 2026-11-16).
- Mapping: Người đóng → payer. Each person column: Paid → Paid, Not paid → Not paid, Not involved → Not involved (not a participant). Equal split. Note → note.
- **Done 2026-11-23** into a fresh storage sheet (the test sheet was kept, renamed TEST). Each row was added through the app's own Add (then Mark who paid for shares already paid back), one at a time, each read back and checked; the result matched sheet2's row count and total. Rows with no date take the row above's date, with a note saying so. Guests (sheet2's "Extra people", or a headcount larger than the household members involved): the payer covers their part, with a note. A row whose headcount leaves out the payer (bought for someone else) has the payer outside the split. Shares use the app's rounding (payer takes leftover cents), so a few debtors owe 1¢ less than sheet2 displayed. Details in private notes.

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
- **While waiting** (loading the list, checking the passcode, any Save), the app shows a spinning circle with what it's doing and how long it's been, counting from 0 ("Saving… 0s", "Saving… 1s", …; user's choice, 2026-11-22). A real progress bar isn't possible: the backend sends one answer at the end and nothing in between.
- **Scroll cues** (added 2026-11-22): while there's more to scroll above or below, a soft gray shadow shows at that edge of the screen, and inside boxes that scroll on their own (the "Mark who paid" checklist with many people). It disappears at the very top or bottom. iPhone Safari shows its own scrollbar only while scrolling and doesn't let a page restyle it, so a drawn "always visible" scrollbar was ruled out as hacky.
- **The app gives up after 60 seconds** without an answer (added 2026-11-22). Without that, a hung request would wait until Safari or Google gave up, anywhere from about 1 to 6 minutes. For a save, the message warns that it may still have saved and to tap Show the latest to check before retrying, because a blind retry could add the same expense twice. (The backend itself waits up to 30 seconds for its turn behind another phone's request, and Google stops any script after 6 minutes.)

### Storage schema: "layout 1", sheet2-style, 5 tabs (approved by the user 2026-11-17; Ideas tab added 2026-11-19)
| Tab | Columns | Notes |
|---|---|---|
| **Expenses** | ID, Date, Description, Total, Payer, Note, Tags (comma-separated, added 2026-11-23), Deleted at, then **one column per person** | Looks like sheet2 and the app. A person cell is `"$12.34 · Not paid"`, `"$12.34 · Paid"`, or `"Not involved"`. It's never blank on an expense row. People columns come last so adding a person appends a column (filled with "Not involved" on existing rows). A non-empty "Deleted at" means it was deleted (hidden from the app; see Safety). The history of changes to an expense lives only in Activity. |
| **Settlements** | Settlement ID, Created at, Covers up to expense #, From, To, Amount, Paid, Paid at, Cancelled at | One row per transfer line; the rows of one settlement repeat its ID, Created at, Covers up to and Cancelled at. Paid is `Paid` or `Not paid`. A settlement is closed when all its lines are Paid and cancelled when Cancelled at is filled (both derived, not stored). Unlike Expenses, one unreadable row fails the whole load (settlements decide what's locked, so guessing is unsafe; only Claude edits this tab by hand). At most one settlement may be pending. "Cancelled at" added 2026-11-22. |
| **Templates** | Name, Payer, Participants (comma-separated names), Default amount | Equal split only. Edited by hand (by Claude); the app only reads it. See "Quick-add templates". |
| **Activity** | Time, Action, Details | Append-only. |
| **Ideas** | ID, Created at, Note, Status, Outcome | One row per note, with a sequential integer ID. Status is `Open`, `Done` or `Dropped`: a dropdown on D2:D1000 that rejects any other value, shown as plain text so empty rows stay clean. Outcome is optional. Rows are never deleted. |

Formatting on the Expenses person columns (I2:AA1000; they started at H until the Tags column was added on 2026-11-23), set up by the setup script through Apps Script:
- Conditional formatting (custom formulas, in this order):
  - `ISNUMBER(SEARCH(" · Not paid", I2))`: dark red (#C00000) fill, white text.
  - `ISNUMBER(SEARCH(" · Paid", I2))`: light green (#D9EAD3) fill.
  - `EXACT(I2, "Not involved")`: gray (#808080) text, no fill.
  - `AND($A2<>"", I$1<>"", I2="")`: yellow (#FFE599) fill. This flags a missing cell on an expense row, because data validation never checks empty cells.
- Data validation, "show warning" (doesn't block): `=IF(OR($A2="", I$1=""), I2="", OR(EXACT(I2, "Not involved"), REGEXMATCH(I2, "^\$[0-9,]+\.[0-9]{2} · (Paid|Not paid)$")))`. Outside expense rows and person columns, a cell must be empty. `EXACT` is needed because `=` ignores case in Sheets. `REGEXMATCH` doesn't survive an xlsx import, so it must be created in Sheets.
- Tested 2026-11-17 in the sample: valid cells show no flag; lowercase "not involved" and junk text in an empty row get the "Invalid" flag; a blank cell on an expense row turns yellow.
- The backend parses person cells with the same rules (exact text, case-sensitive) and reports any cell that doesn't match, including a blank one on an expense row, instead of guessing.

## Out of scope for MVP
- Receipt photos, spending charts and categories, notifications, multiple currencies, user accounts.

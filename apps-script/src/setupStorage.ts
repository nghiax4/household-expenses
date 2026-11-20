// One-time setup, run by the owner from the Apps Script editor: creates the private storage
// spreadsheet with all 5 tabs, headers, formatting and validation.
import {
  IDEA_STATUSES,
  parsePeopleSetting,
  PERSON_CELL_RULES,
  PERSON_RANGE_A1,
  TAB_HEADERS,
  type TabName,
} from './schema';

export const SPREADSHEET_ID_KEY = 'SPREADSHEET_ID';
const HEADER_BACKGROUND = '#d9e2f3';

export function setupStorage(): void {
  const settings = PropertiesService.getScriptProperties();
  const existingId = settings.getProperty(SPREADSHEET_ID_KEY);
  if (existingId) {
    throw new Error(
      `Storage already exists: ${SpreadsheetApp.openById(existingId).getUrl()} ` +
        `(delete the ${SPREADSHEET_ID_KEY} property first to make a new one).`,
    );
  }
  const people = parsePeopleSetting(settings.getProperty('PEOPLE'));
  if (!people.ok) {
    throw new Error(people.error);
  }

  const spreadsheet = SpreadsheetApp.create('Household Expenses (storage)');
  const tabNames = Object.keys(TAB_HEADERS) as TabName[];
  const [firstTab] = spreadsheet.getSheets();
  firstTab!.setName(tabNames[0]!);
  for (const name of tabNames.slice(1)) {
    spreadsheet.insertSheet(name);
  }

  for (const name of tabNames) {
    const sheet = spreadsheet.getSheetByName(name)!;
    const headers: string[] = [...TAB_HEADERS[name]];
    if (name === 'Expenses') {
      headers.push(...people.value);
    }
    writeHeaderRow(sheet, headers);
    // A warning, not a lock: the owner can still fix data by hand in an emergency.
    sheet.protect().setDescription('Edit through the app').setWarningOnly(true);
  }

  formatPersonCells(spreadsheet.getSheetByName('Expenses')!);
  addIdeaStatusDropdown(spreadsheet.getSheetByName('Ideas')!);

  settings.setProperty(SPREADSHEET_ID_KEY, spreadsheet.getId());
  console.log(`Created storage: ${spreadsheet.getUrl()}`);
}

function writeHeaderRow(sheet: GoogleAppsScript.Spreadsheet.Sheet, headers: string[]): void {
  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground(HEADER_BACKGROUND);
  sheet.setFrozenRows(1);
}

function formatPersonCells(expenses: GoogleAppsScript.Spreadsheet.Sheet): void {
  const range = expenses.getRange(PERSON_RANGE_A1);
  const rule = () => SpreadsheetApp.newConditionalFormatRule().setRanges([range]);
  expenses.setConditionalFormatRules([
    rule()
      .whenFormulaSatisfied(`=${PERSON_CELL_RULES.notPaid}`)
      .setBackground('#c00000')
      .setFontColor('#ffffff')
      .build(),
    rule().whenFormulaSatisfied(`=${PERSON_CELL_RULES.paid}`).setBackground('#d9ead3').build(),
    rule()
      .whenFormulaSatisfied(`=${PERSON_CELL_RULES.notInvolved}`)
      .setFontColor('#808080')
      .build(),
    // Data validation never checks empty cells, so a missing cell is highlighted instead.
    rule().whenFormulaSatisfied(`=${PERSON_CELL_RULES.missing}`).setBackground('#ffe599').build(),
  ]);
  range.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireFormulaSatisfied(PERSON_CELL_RULES.valid)
      .setAllowInvalid(true)
      .build(),
  );
}

function addIdeaStatusDropdown(ideas: GoogleAppsScript.Spreadsheet.Sheet): void {
  const statusColumn = TAB_HEADERS.Ideas.indexOf('Status') + 1;
  ideas.getRange(2, statusColumn, 999, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList([...IDEA_STATUSES], false)
      .setAllowInvalid(false)
      .build(),
  );
}

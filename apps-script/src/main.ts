// Entry points Apps Script calls. The build (apps-script/build.mjs) exposes these as the
// global functions doGet, doPost and setupStorage.
import { fail, ok } from '../../src/domain/result';
import type { SheetCell } from './expensesTab';
import { handleRequest, type SheetStorage } from './handleRequest';
import type { TabName } from './schema';
import { SPREADSHEET_ID_KEY } from './setupStorage';

export { setupStorage } from './setupStorage';

/** Lets anyone confirm the backend is up, without revealing anything. */
export function doGet(): GoogleAppsScript.Content.TextOutput {
  return json(ok({ service: 'household-expenses' }));
}

/**
 * Every app request is a POST with a JSON body sent as text/plain (that content type avoids
 * a CORS preflight, which Apps Script can't answer).
 */
export function doPost(event: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  const settings = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  try {
    // One request at a time, so two phones saving at once can't both take the same expense ID.
    lock.waitLock(30_000);
    return json(
      handleRequest(event.postData?.contents ?? '', {
        passcode: settings.getProperty('PASSCODE'),
        storage: sheetStorage(settings.getProperty(SPREADSHEET_ID_KEY)),
        now: () =>
          Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
      }),
    );
  } catch (error) {
    // Without this, Apps Script answers with an HTML error page the app can't read.
    const reason = error instanceof Error ? error.message : String(error);
    return json(fail(`The server ran into a problem: ${reason}`));
  } finally {
    lock.releaseLock();
  }
}

/** The storage spreadsheet, opened only when a request actually needs it. */
function sheetStorage(spreadsheetId: string | null): SheetStorage {
  function tab(name: TabName): GoogleAppsScript.Spreadsheet.Sheet {
    if (!spreadsheetId) {
      throw new Error('there’s no storage sheet yet. Run setupStorage first.');
    }
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(name);
    if (!sheet) {
      throw new Error(`the storage sheet has no "${name}" tab.`);
    }
    return sheet;
  }

  return {
    readTab: (name) => tab(name).getDataRange().getDisplayValues(),
    appendRow: (name, cells: readonly SheetCell[]) => {
      const sheet = tab(name);
      const row = sheet.getRange(sheet.getLastRow() + 1, 1, 1, cells.length);
      // Formats first, so a date written as text is stored as a date.
      cells.forEach((cell, i) => {
        if (cell.numberFormat) {
          row.getCell(1, i + 1).setNumberFormat(cell.numberFormat);
        }
      });
      row.setValues([cells.map((cell) => cell.value)]);
    },
  };
}

function json(value: unknown): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// Entry points Apps Script calls. The build (apps-script/build.mjs) exposes these as the
// global functions doGet, doPost and setupStorage.
import { ok } from '../../src/domain/result';
import { handleRequest } from './handleRequest';

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
  const passcode = PropertiesService.getScriptProperties().getProperty('PASSCODE');
  return json(handleRequest(event.postData?.contents ?? '', passcode));
}

function json(value: unknown): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

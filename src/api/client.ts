import { fail } from '../domain/result';
import type { ApiAction, ApiRequest, ApiResponse } from './protocol';

/**
 * The deployed Apps Script web app. Public on purpose: it's built into the site anyway,
 * and every request needs the household passcode.
 */
export const BACKEND_URL =
  'https://script.google.com/macros/s/AKfycbzPYv2AXyE0R-lKIMSBRHMCLhRWuvRbVTcGACBqFkWOYkbc9kfwYfUs7tjARP5eMM_S/exec';

/**
 * How long to wait for an answer. Normal requests take 1–2 seconds; without a limit of our own,
 * a hung request would leave the app waiting until Safari or Google gave up (1 to 6 minutes).
 */
export const GIVE_UP_AFTER_MS = 60_000;

/** Requests that only read. Every other request changes the sheet. */
const READS: ReadonlySet<ApiAction> = new Set(['checkPasscode', 'listExpenses']);

/** Sends one request to the backend. Never throws: network trouble comes back as a failure. */
export async function callBackend<A extends ApiAction>(
  request: ApiRequest & { action: A },
): Promise<ApiResponse<A>> {
  // A plain timer rather than AbortSignal.timeout, which older iPhones (before iOS 16) lack.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      // text/plain keeps this a "simple" request, so the browser skips the CORS preflight
      // that Apps Script can't answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) {
      return fail(`The server had a problem (error ${response.status}). Try again in a moment.`);
    }
    return (await response.json()) as ApiResponse<A>;
  } catch {
    if (controller.signal.aborted) {
      // The app stops waiting, but the server may still finish the job, so a blind retry
      // could add the same expense twice.
      return fail(
        READS.has(request.action)
          ? 'The server didn’t answer within a minute. Try again.'
          : 'The server didn’t answer within a minute. It may still have saved: tap Show the latest to check before trying again.',
      );
    }
    return fail('Couldn’t reach the server. Check your internet connection and try again.');
  } finally {
    clearTimeout(timer);
  }
}

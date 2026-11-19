import { fail } from '../domain/result';
import type { ApiAction, ApiRequest, ApiResponse } from './protocol';

/**
 * The deployed Apps Script web app. Public on purpose: it's built into the site anyway,
 * and every request needs the household passcode.
 */
export const BACKEND_URL =
  'https://script.google.com/macros/s/AKfycbzPYv2AXyE0R-lKIMSBRHMCLhRWuvRbVTcGACBqFkWOYkbc9kfwYfUs7tjARP5eMM_S/exec';

/** Sends one request to the backend. Never throws: network trouble comes back as a failure. */
export async function callBackend<A extends ApiAction>(
  request: ApiRequest & { action: A },
): Promise<ApiResponse<A>> {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      // text/plain keeps this a "simple" request, so the browser skips the CORS preflight
      // that Apps Script can't answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      return fail(`The server had a problem (error ${response.status}). Try again in a moment.`);
    }
    return (await response.json()) as ApiResponse<A>;
  } catch {
    return fail('Couldn’t reach the server. Check your internet connection and try again.');
  }
}

// The request/response format between the app and the Apps Script backend. Shared by both
// sides, so they can't disagree.
import type { Result } from '../domain/result';

/** Every request carries the household passcode; the backend rejects it otherwise. */
export type ApiRequest = { passcode: string; action: 'checkPasscode' };

export type ApiAction = ApiRequest['action'];

/** What each action returns when it succeeds. */
export interface ApiResults {
  checkPasscode: Record<string, never>;
}

export type ApiResponse<A extends ApiAction> = Result<ApiResults[A]>;

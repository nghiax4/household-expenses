import type { ApiRequest } from '../../src/api/protocol';
import { fail, ok, type Result } from '../../src/domain/result';

/**
 * Decides what to answer, given the raw request body and the passcode stored in the
 * script's settings. Pure (no Google services), so it can be unit-tested.
 */
export function handleRequest(rawBody: string, storedPasscode: string | null): Result<unknown> {
  if (!storedPasscode) {
    return fail('The backend isn’t set up yet: no passcode has been saved.');
  }

  const request = parseRequest(rawBody);
  if (!request) {
    return fail('The request was malformed.');
  }
  if (request.passcode !== storedPasscode) {
    return fail('Wrong passcode.');
  }

  switch (request.action) {
    case 'checkPasscode':
      return ok({});
  }
}

function parseRequest(rawBody: string): ApiRequest | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (
    typeof body === 'object' &&
    body !== null &&
    'passcode' in body &&
    typeof body.passcode === 'string' &&
    'action' in body &&
    body.action === 'checkPasscode'
  ) {
    return { passcode: body.passcode, action: body.action };
  }
  return null;
}

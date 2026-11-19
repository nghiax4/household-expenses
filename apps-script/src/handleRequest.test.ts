import { describe, expect, it } from 'vitest';
import { handleRequest } from './handleRequest';

const body = (value: unknown) => JSON.stringify(value);

describe('handleRequest', () => {
  it('accepts the right passcode', () => {
    expect(handleRequest(body({ passcode: 'abc123', action: 'checkPasscode' }), 'abc123')).toEqual({
      ok: true,
      value: {},
    });
  });

  it('rejects a wrong passcode, including different case', () => {
    expect(handleRequest(body({ passcode: 'nope', action: 'checkPasscode' }), 'abc123')).toEqual({
      ok: false,
      error: 'Wrong passcode.',
    });
    expect(handleRequest(body({ passcode: 'ABC123', action: 'checkPasscode' }), 'abc123').ok).toBe(
      false,
    );
  });

  it('refuses everything until a passcode has been saved', () => {
    for (const stored of [null, '']) {
      const result = handleRequest(body({ passcode: '', action: 'checkPasscode' }), stored);
      expect(result.ok).toBe(false);
    }
  });

  it.each([
    ['not JSON', '{oops'],
    ['empty body', ''],
    ['missing passcode', body({ action: 'checkPasscode' })],
    ['passcode not a string', body({ passcode: 123, action: 'checkPasscode' })],
    ['unknown action', body({ passcode: 'abc123', action: 'deleteEverything' })],
    ['not an object', body('abc123')],
  ])('rejects a malformed request (%s)', (_, raw) => {
    expect(handleRequest(raw, 'abc123')).toEqual({
      ok: false,
      error: 'The request was malformed.',
    });
  });
});

/**
 * True when two JSON-like values hold the same data: same keys and values at every level, in any
 * key order. Missing keys and keys set to undefined count as the same, as they do once sent as
 * JSON.
 *
 * Why: a save carries the expense or settlement as the phone last saw it, and the backend refuses
 * the save if the sheet now holds anything different (another phone changed it meanwhile).
 */
export function sameData(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameData(item, b[i]))
    );
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...definedKeys(a), ...definedKeys(b)]);
    return [...keys].every((key) => sameData(a[key], b[key]));
  }
  return Object.is(a, b);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function definedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => value[key] !== undefined);
}

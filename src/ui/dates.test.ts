import { describe, expect, it } from 'vitest';
import { formatDate, localDate } from './dates';

describe('localDate', () => {
  it('counts back in local days, across month and year ends', () => {
    const now = new Date(2026, 0, 1, 0, 30); // 12:30 a.m. on Jan 1, local time
    expect(localDate(0, now)).toBe('2026-01-01');
    expect(localDate(1, now)).toBe('2025-12-31');
    expect(localDate(0, new Date(2026, 2, 1, 23, 59))).toBe('2026-03-01');
    expect(localDate(1, new Date(2024, 2, 1))).toBe('2024-02-29');
  });
});

describe('formatDate', () => {
  it('leaves out the year only for the current year', () => {
    expect(formatDate('2026-11-05', '2026-11-21')).toBe('Nov 5');
    expect(formatDate('2025-12-31', '2026-01-01')).toBe('Dec 31, 2025');
  });
});

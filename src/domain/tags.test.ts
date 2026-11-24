import { describe, expect, it } from 'vitest';
import type { Expense } from './expense';
import { billIndex, formatTags, normalizeTags, parseTags, sameTag, suggestedTags } from './tags';
import type { Template } from './template';

const template = (name: string): Template => ({
  name,
  payer: 'Anh',
  participants: ['Anh', 'Bảo'],
  defaultAmount: null,
});
const TEMPLATES = [template('Rent'), template('Internet')];

const expense = (id: number, tags: string[], deletedAt: string | null = null): Expense => ({
  id,
  date: '2026-11-20',
  description: `Expense ${id}`,
  total: 100,
  payer: 'Anh',
  note: '',
  tags,
  deletedAt,
  people: { Anh: { kind: 'share', amount: 100, status: 'Paid' } },
});

describe('normalizeTags', () => {
  it('trims, drops empty ones, and keeps the first of a repeat in any case', () => {
    expect(normalizeTags([' Rent ', '', 'groceries', 'RENT', 'Groceries'])).toEqual({
      ok: true,
      value: ['Rent', 'groceries'],
    });
  });

  it('refuses a comma (the sheet separates tags with commas) and a very long tag', () => {
    expect(normalizeTags(['Rent, Nov'])).toEqual({
      ok: false,
      error: 'The tag "Rent, Nov" can\'t contain a comma.',
    });
    expect(normalizeTags(['x'.repeat(31)]).ok).toBe(false);
    expect(normalizeTags(['x'.repeat(30)]).ok).toBe(true);
  });
});

describe('tags in a sheet cell', () => {
  it('round-trips through the comma-separated cell', () => {
    expect(formatTags(['Rent', 'Tiền điện'])).toBe('Rent, Tiền điện');
    expect(parseTags('Rent, Tiền điện')).toEqual(['Rent', 'Tiền điện']);
    expect(parseTags('')).toEqual([]);
    expect(parseTags(' Rent ,, Food ')).toEqual(['Rent', 'Food']);
  });
});

describe('suggestedTags', () => {
  it('offers the bills first, then other tags in use, most used first', () => {
    const expenses = [
      expense(1, ['Groceries', 'rent']),
      expense(2, ['Rides']),
      expense(3, ['Groceries']),
      expense(4, ['Trip'], '2026-11-21 10:00'),
    ];
    // "rent" is the Rent bill; the deleted expense's tag isn't offered.
    expect(suggestedTags(expenses, TEMPLATES)).toEqual(['Rent', 'Internet', 'Groceries', 'Rides']);
  });
});

describe('billIndex', () => {
  it('finds the bill a tag stands for, ignoring case', () => {
    expect(billIndex('internet', TEMPLATES)).toBe(1);
    expect(billIndex('Groceries', TEMPLATES)).toBeNull();
    expect(sameTag('Tiền Điện', 'tiền điện')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import type { Expense } from './expense';
import { foldForSearch, matchesSearch } from './search';

// Made-up people and amounts (the repo is public).
const ELECTRICITY: Expense = {
  id: 1,
  date: '2026-11-09',
  description: 'Tiền điện',
  total: 123456,
  payer: 'Bảo',
  note: 'Tháng 11',
  tags: ['Electricity'],
  deletedAt: null,
  people: {
    Anh: { kind: 'share', amount: 61728, status: 'Not paid' },
    Bảo: { kind: 'share', amount: 61728, status: 'Paid' },
    Đức: { kind: 'notInvolved' },
  },
};

describe('foldForSearch', () => {
  it('drops case and Vietnamese accents, including đ', () => {
    expect(foldForSearch('Tiền ĐIỆN Đức')).toBe('tien dien duc');
  });
});

describe('matchesSearch', () => {
  it.each([
    ['', 'nothing typed'],
    ['tien dien', 'the description without accents'],
    ['Tiền Điện', 'the description with accents, any case'],
    ['thang 11', 'the note'],
    ['electric', 'part of a tag'],
    ['bao', 'the payer'],
    ['anh', 'a participant'],
    ['1,234', 'the total as shown'],
    ['1234.56', 'the total as typed'],
    ['  dien  ', 'with stray spaces around'],
  ])('matches "%s" (%s)', (query) => {
    expect(matchesSearch(ELECTRICITY, query)).toBe(true);
  });

  it.each([
    ['duc', 'someone who is not involved'],
    ['internet', 'a word that is nowhere'],
    ['dien thang', 'text running from one field into the next'],
  ])('does not match "%s" (%s)', (query) => {
    expect(matchesSearch(ELECTRICITY, query)).toBe(false);
  });
});

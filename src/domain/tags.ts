import type { Expense } from './expense';
import { fail, ok, type Result } from './result';
import type { Template } from './template';

/** Long enough for "Groceries" or "Tiền điện", short enough to stay a label. */
export const MAX_TAG_LENGTH = 30;

/**
 * Cleans an expense's tags: trimmed, empty ones dropped, and a repeat (ignoring case) dropped
 * so "rent" and "Rent" can't both appear. Refuses a tag with a comma, because the sheet keeps
 * tags in one cell separated by commas.
 */
export function normalizeTags(tags: readonly string[]): Result<string[]> {
  const kept: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (tag === '') {
      continue;
    }
    if (tag.includes(',')) {
      return fail(`The tag "${tag}" can't contain a comma.`);
    }
    if (tag.length > MAX_TAG_LENGTH) {
      return fail(`The tag "${tag}" is too long (${MAX_TAG_LENGTH} characters at most).`);
    }
    if (!kept.some((k) => sameTag(k, tag))) {
      kept.push(tag);
    }
  }
  return ok(kept);
}

/** Tags match ignoring case, so typing "rent" picks up the existing "Rent". */
export function sameTag(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

/** How tags are written in their sheet cell, e.g. "Rent, Groceries". */
export function formatTags(tags: readonly string[]): string {
  return tags.join(', ');
}

/** The tags in a sheet cell, e.g. "Rent, Groceries" → ["Rent", "Groceries"]. */
export function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
}

/**
 * Tags to offer when adding or editing: the templates' names first (the bills, so they're there
 * even before first use), then every other tag on a live expense, most used first.
 */
export function suggestedTags(
  expenses: readonly Expense[],
  templates: readonly Template[],
): string[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const expense of expenses) {
    if (expense.deletedAt !== null) {
      continue;
    }
    for (const tag of expense.tags) {
      const key = tag.toLocaleLowerCase();
      const entry = counts.get(key) ?? { tag, count: 0 };
      counts.set(key, { ...entry, count: entry.count + 1 });
    }
  }
  const bills = templates.map((template) => template.name);
  const others = [...counts.values()]
    .filter(({ tag }) => !bills.some((bill) => sameTag(bill, tag)))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .map(({ tag }) => tag);
  return [...bills, ...others];
}

/**
 * Which bill a tag stands for: the position of the template with that name (ignoring case), or
 * null for an ordinary tag. Bills get their own color, so they stand out in the list.
 */
export function billIndex(tag: string, templates: readonly Template[]): number | null {
  const index = templates.findIndex((template) => sameTag(template.name, tag));
  return index === -1 ? null : index;
}

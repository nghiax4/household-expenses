import { billIndex } from '../domain/tags';
import type { Template } from '../domain/template';

/**
 * One color per bill, in Templates-tab order. Red and green are left out: they already mean
 * Not paid and Paid on the share chips.
 */
const BILL_COLORS = [
  'bg-sky-600 text-white',
  'bg-violet-600 text-white',
  'bg-amber-400 text-amber-950',
  'bg-teal-600 text-white',
  'bg-indigo-600 text-white',
  'bg-fuchsia-600 text-white',
];
const PLAIN = 'border border-slate-300 text-slate-600';

/** A tag's colors: a bill's own color, or a quiet outline for any other tag. */
export function tagColors(tag: string, templates: readonly Template[]): string {
  const bill = billIndex(tag, templates);
  return bill === null ? PLAIN : (BILL_COLORS[bill % BILL_COLORS.length] ?? PLAIN);
}

import type { Cents, PersonName } from './money';
import type { PersonCell } from './personCell';

/** One row of the Expenses tab. */
export interface Expense {
  /** Sequential and never reused, so "expenses up to #N" is a fixed set. */
  id: number;
  /** Calendar date, "YYYY-MM-DD". */
  date: string;
  description: string;
  total: Cents;
  payer: PersonName;
  note: string;
  /** When it was moved to the trash, or null if it's live. */
  deletedAt: string | null;
  /** Every person's cell, in person-column order. */
  people: ReadonlyMap<PersonName, PersonCell>;
}

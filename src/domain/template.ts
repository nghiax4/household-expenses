import type { Cents, PersonName } from './money';

/**
 * A quick-fill preset for a recurring bill, from one row of the Templates tab. Using it fills
 * the Add form; it never affects balances. Templates always split equally.
 */
export interface Template {
  /** Becomes the expense's description, e.g. "Internet". Unique (ignoring case). */
  name: string;
  payer: PersonName;
  /** Who shares the bill, in person-column order. */
  participants: PersonName[];
  /** Pre-filled in Total when set; left empty for bills that change (e.g. electricity). */
  defaultAmount: Cents | null;
}

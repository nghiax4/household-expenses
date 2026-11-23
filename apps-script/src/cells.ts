// How values are written to the storage sheet, shared by every tab.
import type { Cents } from '../../src/domain/money';

/** One cell to write, with an optional sheet number format such as "yyyy-mm-dd". */
export interface SheetCell {
  value: string | number;
  numberFormat?: string;
}

/**
 * Text the sheet stores exactly as given. The leading apostrophe is hidden by Sheets and stops
 * it from turning "1/2" into a date or "=..." into a formula.
 */
export function literal(text: string): SheetCell {
  return { value: text === '' ? '' : `'${text}` };
}

/** Money as a real number shown like "$1,234.56", which is also how it's read back. */
export function dollarsCell(amount: Cents): SheetCell {
  return { value: amount / 100, numberFormat: '$#,##0.00' };
}

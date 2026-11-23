// The storage sheet's layout ("layout 1" in docs/requirements.md). Pure data and functions,
// so the rules can be unit-tested without Google services.
import { NOT_INVOLVED_TEXT } from '../../src/domain/personCell';
import { fail, ok, type Result } from '../../src/domain/result';

export const TAB_HEADERS = {
  Expenses: ['ID', 'Date', 'Description', 'Total', 'Payer', 'Note', 'Deleted at'],
  Settlements: [
    'Settlement ID',
    'Created at',
    'Covers up to expense #',
    'From',
    'To',
    'Amount',
    'Paid',
    'Paid at',
    'Cancelled at',
  ],
  Templates: ['Name', 'Payer', 'Participants', 'Default amount'],
  Activity: ['Time', 'Action', 'Details'],
  Ideas: ['ID', 'Created at', 'Note', 'Status', 'Outcome'],
} as const;

export type TabName = keyof typeof TAB_HEADERS;

/** People columns start after the fixed Expenses columns (column H). */
export const FIRST_PERSON_COLUMN = TAB_HEADERS.Expenses.length + 1;
/** Formatting and validation cover columns H to Z, room for 19 people. */
export const PERSON_RANGE_A1 = 'H2:Z1000';

export const IDEA_STATUSES = ['Open', 'Done', 'Dropped'] as const;

/**
 * Sheet formulas for the person cells, relative to H2. Kept in sync with
 * docs/requirements.md → "Formatting on the Expenses person columns".
 */
export const PERSON_CELL_RULES = {
  notPaid: 'ISNUMBER(SEARCH(" · Not paid", H2))',
  paid: 'ISNUMBER(SEARCH(" · Paid", H2))',
  notInvolved: `EXACT(H2, "${NOT_INVOLVED_TEXT}")`,
  missing: 'AND($A2<>"", H$1<>"", H2="")',
  valid:
    `=IF(OR($A2="", H$1=""), H2="", OR(EXACT(H2, "${NOT_INVOLVED_TEXT}"), ` +
    'REGEXMATCH(H2, "^\\$[0-9,]+\\.[0-9]{2} · (Paid|Not paid)$")))',
} as const;

/**
 * Reads the PEOPLE script setting: full names in person-column order, separated by commas.
 * The names live in the script's private settings, never in this public code.
 */
export function parsePeopleSetting(setting: string | null): Result<string[]> {
  const people = (setting ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  if (people.length === 0) {
    return fail('Add a PEOPLE script property first, e.g. "Anh, Bảo, Chi".');
  }
  const duplicate = people.find((name, i) => people.indexOf(name) !== i);
  if (duplicate) {
    return fail(`"${duplicate}" is listed twice in PEOPLE. Names must be unique.`);
  }
  return ok(people);
}

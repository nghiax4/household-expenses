// Reading the Templates tab, which is edited by hand in the sheet. Pure, so the rules are
// unit-tested without Google services.
import { parseTypedAmount, type PersonName } from '../../src/domain/money';
import { fail, ok, type Result } from '../../src/domain/result';
import type { Template } from '../../src/domain/template';
import { TAB_HEADERS } from './schema';

/**
 * Reads the Templates tab from its displayed cells, header row first. Never fails as a whole:
 * templates are only shortcuts, so a broken row (or header) is reported and skipped while the
 * rest of the app keeps working.
 */
export function readTemplatesTab(
  rows: readonly (readonly string[])[],
  people: readonly PersonName[],
): { templates: Template[]; problems: string[] } {
  const [header = [], ...dataRows] = rows;
  const expected: readonly string[] = TAB_HEADERS.Templates;
  if (!expected.every((name, i) => header[i] === name)) {
    return {
      templates: [],
      problems: [`The Templates tab's header row must be: ${expected.join(', ')}.`],
    };
  }

  const templates: Template[] = [];
  const problems: string[] = [];
  dataRows.forEach((row, index) => {
    if (row.every((cell) => cell.trim() === '')) {
      return;
    }
    const rowNumber = index + 2;
    const template = readTemplateRow(row, people);
    const duplicate =
      template.ok &&
      templates.some((t) => t.name.toLowerCase() === template.value.name.toLowerCase());
    if (!template.ok) {
      problems.push(`Templates row ${rowNumber}: ${template.error}`);
    } else if (duplicate) {
      problems.push(`Templates row ${rowNumber}: "${template.value.name}" is already used above.`);
    } else {
      templates.push(template.value);
    }
  });
  return { templates, problems };
}

function readTemplateRow(row: readonly string[], people: readonly PersonName[]): Result<Template> {
  // Typed by hand, so stray spaces are forgiven; names must still match a column exactly.
  const [name = '', payer = '', participantsText = '', amountText = ''] = row.map((cell) =>
    cell.trim(),
  );
  if (name === '') {
    return fail('the name is empty.');
  }
  if (!people.includes(payer)) {
    return fail(`the payer "${payer}" doesn't match any person column in Expenses.`);
  }

  const named = participantsText
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (named.length === 0) {
    return fail('Participants is empty. List names separated by commas.');
  }
  const stranger = named.find((person) => !people.includes(person));
  if (stranger !== undefined) {
    return fail(`"${stranger}" in Participants doesn't match any person column in Expenses.`);
  }
  if (new Set(named).size !== named.length) {
    return fail('Participants lists someone twice.');
  }

  let defaultAmount = null;
  if (amountText !== '') {
    const amount = parseTypedAmount(amountText);
    if (!amount.ok) {
      return fail(`the default amount "${amountText}" isn't an amount like 40.00.`);
    }
    defaultAmount = amount.value;
  }

  return ok({
    name,
    payer,
    participants: people.filter((person) => named.includes(person)),
    defaultAmount,
  });
}

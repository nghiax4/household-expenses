import { describe, expect, it } from 'vitest';
import { TAB_HEADERS } from './schema';
import { readTemplatesTab } from './templatesTab';

// Made-up people (the repo is public), in person-column order.
const PEOPLE = ['Anh', 'Bảo', 'Chi', 'Dương'];
const HEADER = [...TAB_HEADERS.Templates];

describe('readTemplatesTab', () => {
  it('reads templates, forgiving stray spaces and putting participants in column order', () => {
    const rows = [
      HEADER,
      ['Internet', 'Anh', 'Dương, Anh ,Bảo', '55'],
      [' Electricity ', 'Bảo', 'Anh, Bảo', ''],
      ['', '', '', ''],
      ['Rent', 'Anh', 'Anh, Bảo, Chi, Dương', '$1,234.50'],
    ];
    expect(readTemplatesTab(rows, PEOPLE)).toEqual({
      templates: [
        {
          name: 'Internet',
          payer: 'Anh',
          participants: ['Anh', 'Bảo', 'Dương'],
          defaultAmount: 5500,
        },
        { name: 'Electricity', payer: 'Bảo', participants: ['Anh', 'Bảo'], defaultAmount: null },
        {
          name: 'Rent',
          payer: 'Anh',
          participants: ['Anh', 'Bảo', 'Chi', 'Dương'],
          defaultAmount: 123450,
        },
      ],
      problems: [],
    });
  });

  it('skips and explains rows it can’t read, keeping the good ones', () => {
    const rows = [
      HEADER,
      ['', 'Anh', 'Anh', ''],
      ['Gas', 'anh', 'Anh', ''],
      ['Gas', 'Anh', '', ''],
      ['Gas', 'Anh', 'Anh, Zed', ''],
      ['Gas', 'Anh', 'Anh, Anh', ''],
      ['Gas', 'Anh', 'Anh', 'forty'],
      ['Water', 'Chi', 'Chi', '0'],
      ['Phone', 'Chi', 'Chi', ''],
      ['phone', 'Chi', 'Chi', ''],
    ];
    expect(readTemplatesTab(rows, PEOPLE)).toEqual({
      templates: [{ name: 'Phone', payer: 'Chi', participants: ['Chi'], defaultAmount: null }],
      problems: [
        'Templates row 2: the name is empty.',
        'Templates row 3: the payer "anh" doesn\'t match any person column in Expenses.',
        'Templates row 4: Participants is empty. List names separated by commas.',
        'Templates row 5: "Zed" in Participants doesn\'t match any person column in Expenses.',
        'Templates row 6: Participants lists someone twice.',
        'Templates row 7: the default amount "forty" isn\'t an amount like 40.00.',
        'Templates row 8: the default amount "0" isn\'t an amount like 40.00.',
        'Templates row 10: "phone" is already used above.',
      ],
    });
  });

  it('reports a changed header instead of guessing what the columns mean', () => {
    expect(
      readTemplatesTab(
        [
          ['Name', 'Who paid'],
          ['Gas', 'Anh'],
        ],
        PEOPLE,
      ),
    ).toEqual({
      templates: [],
      problems: [
        "The Templates tab's header row must be: Name, Payer, Participants, Default amount.",
      ],
    });
    expect(readTemplatesTab([], PEOPLE).templates).toEqual([]);
  });
});

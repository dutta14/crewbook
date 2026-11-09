import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import {
  CSV_COLUMNS,
  CSV_UNENCRYPTED_REMINDER,
  buildRosterCsv,
  exportRosterCsv,
  rosterFileName,
  toCsvCell,
} from './exportCSV';
import * as download from './downloadFile';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toCsvCell', () => {
  it('leaves plain text alone', () => {
    expect(toCsvCell('Alex Chen')).toBe('Alex Chen');
  });

  it.each([
    ['Chen, Alex', '"Chen, Alex"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
  ])('quotes %j', (value, expected) => {
    expect(toCsvCell(value)).toBe(expected);
  });

  it.each(['=SUM(A1)', '+1', '-1', '@cmd', '\tx', '\rx'])(
    'stops %j from running as a spreadsheet formula',
    (value) => {
      expect(toCsvCell(value).replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('does not change a dash in the middle of text', () => {
    expect(toCsvCell('Staff - Platform')).toBe('Staff - Platform');
  });
});

describe('buildRosterCsv', () => {
  it('writes only the five roster columns as the header', () => {
    expect(buildRosterCsv([]).split('\r\n')[0]).toBe('name,role,level,email,status');
    expect(CSV_COLUMNS).toEqual(['name', 'role', 'level', 'email', 'status']);
  });

  it('writes a header and a final line break for an empty roster', () => {
    expect(buildRosterCsv([])).toBe('name,role,level,email,status\r\n');
  });

  it('writes one row per person', () => {
    const csv = buildRosterCsv([
      createMember({ name: 'Alex Chen', role: 'Engineer', level: 'L4', email: 'a@x.com' }),
      createMember({ name: 'Sam Lee', role: 'Designer', level: 'L5', email: 'sam@x.com' }),
    ]);

    expect(csv.split('\r\n')).toEqual([
      'name,role,level,email,status',
      'Alex Chen,Engineer,L4,a@x.com,active',
      'Sam Lee,Designer,L5,sam@x.com,active',
      '',
    ]);
  });

  it('never includes any other field of a person', () => {
    const csv = buildRosterCsv([
      createMember({
        id: 'secret-id',
        manager: 'secret-manager',
        startDate: '2001-02-03T00:00:00.000Z',
        customFields: { f1: 'secret-custom-value' },
      }),
    ]);

    for (const secret of ['secret-id', 'secret-manager', '2001', 'secret-custom-value']) {
      expect(csv).not.toContain(secret);
    }
  });

  it('neutralises a formula in a name', () => {
    const csv = buildRosterCsv([createMember({ name: '=HYPERLINK("http://evil")' })]);

    expect(csv.split('\r\n')[1].startsWith('"\'=HYPERLINK')).toBe(true);
  });
});

describe('exportRosterCsv', () => {
  it('names the file by date and saves it with a byte order mark', () => {
    const save = vi.spyOn(download, 'downloadFile').mockImplementation(() => undefined);

    const name = exportRosterCsv([createMember({ name: 'Zoë' })], new Date(2025, 10, 3));

    expect(name).toBe('crewbook-roster-2025-11-03.csv');
    expect(save).toHaveBeenCalledWith(
      expect.stringMatching(/^\uFEFFname,role/),
      'crewbook-roster-2025-11-03.csv',
      'text/csv;charset=utf-8',
    );
  });

  it('pads single digit months and days in the file name', () => {
    expect(rosterFileName(new Date(2025, 0, 5))).toBe('crewbook-roster-2025-01-05.csv');
  });

  it('has a reminder to delete the file', () => {
    expect(CSV_UNENCRYPTED_REMINDER).toMatch(/delete the export file/);
  });
});

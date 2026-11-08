import { describe, expect, it } from 'vitest';
import {
  CSV_LIMITS,
  CSV_PARSE_ERROR,
  CSV_ROW_LIMIT_ERROR,
  CSV_SIZE_ERROR,
  CSV_TYPE_ERROR,
  CsvParseError,
  parseCsv,
  validateCsvFile,
  validateRow,
} from './csvParser';

const HEADER = 'name,role,level,startDate,email,manager,status';

describe('parseCsv', () => {
  it('parses valid CSV with all headers correctly', () => {
    const rows = parseCsv(
      `${HEADER}\nJane Doe,Engineer,L5,2022-03-14,jane@example.com,Sam Lee,on_leave\n`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Jane Doe',
      role: 'Engineer',
      level: 'L5',
      startDate: '2022-03-14',
      email: 'jane@example.com',
      manager: 'Sam Lee',
      status: 'on_leave',
      isValid: true,
      errors: [],
    });
    expect(rows[0].raw.name).toBe('Jane Doe');
  });

  it('handles missing optional columns gracefully', () => {
    const rows = parseCsv('name\nJane Doe');

    expect(rows[0]).toMatchObject({
      name: 'Jane Doe',
      role: '',
      level: '',
      startDate: '',
      email: '',
      manager: '',
      status: 'active',
      isValid: true,
    });
  });

  it('flags rows with missing name as invalid', () => {
    const [row] = parseCsv(`${HEADER}\n,Engineer,L5,,jane@example.com,,active`);

    expect(row.isValid).toBe(false);
    expect(row.errors).toEqual(['Missing name']);
  });

  it('flags rows with malformed email as invalid', () => {
    const [row] = parseCsv(`${HEADER}\nJane Doe,,,,not-an-email,,active`);

    expect(row.isValid).toBe(false);
    expect(row.errors).toEqual(['Invalid email format']);
  });

  it('rejects non-csv files', () => {
    expect(validateCsvFile({ name: 'roster.xlsx', type: '', size: 10 })).toBe(CSV_TYPE_ERROR);
    expect(validateCsvFile({ name: 'roster.csv', type: 'image/png', size: 10 })).toBe(
      CSV_TYPE_ERROR,
    );
    expect(validateCsvFile({ name: 'roster', type: 'text/csv', size: 10 })).toBe(CSV_TYPE_ERROR);
  });

  it('accepts .csv files with a csv or empty MIME type', () => {
    expect(validateCsvFile({ name: 'Roster.CSV', type: 'text/csv', size: 10 })).toBeNull();
    expect(validateCsvFile({ name: 'roster.csv', type: '', size: 10 })).toBeNull();
  });

  it('rejects files over 1 MB', () => {
    const file = { name: 'roster.csv', type: 'text/csv', size: CSV_LIMITS.maxBytes + 1 };

    expect(validateCsvFile(file)).toBe(CSV_SIZE_ERROR);
    expect(validateCsvFile({ ...file, size: CSV_LIMITS.maxBytes })).toBeNull();
  });

  it('empty CSV file with only headers returns zero rows', () => {
    expect(parseCsv(`${HEADER}\n`)).toEqual([]);
    expect(parseCsv(HEADER)).toEqual([]);
  });

  it('ignores extra unknown columns', () => {
    const [row] = parseCsv('name,favorite color,email\nJane Doe,teal,jane@example.com');

    expect(row.name).toBe('Jane Doe');
    expect(row.email).toBe('jane@example.com');
    expect(Object.keys(row.raw).sort()).toEqual(['email', 'name']);
  });

  it('handles CSV with quoted fields containing commas', () => {
    const [row] = parseCsv(`${HEADER}\n"Doe, Jane","Engineer, Staff",L6,,,,active`);

    expect(row.name).toBe('Doe, Jane');
    expect(row.role).toBe('Engineer, Staff');
    expect(row.level).toBe('L6');
  });

  it('handles escaped quotes, embedded line breaks and CRLF line endings', () => {
    const rows = parseCsv(
      'name,role\r\n"Jane ""JD"" Doe","Line one\nLine two"\r\nSam Lee,Designer\r\n',
    );

    expect(rows.map((row) => row.name)).toEqual(['Jane "JD" Doe', 'Sam Lee']);
    expect(rows[0].role).toBe('Line one\nLine two');
  });

  it('skips blank lines', () => {
    expect(parseCsv('name\n\nJane Doe\n   \n\nSam Lee\n')).toHaveLength(2);
  });

  it('strips a leading byte order mark', () => {
    const [row] = parseCsv('\uFEFFname,role\nJane Doe,Engineer');

    expect(row.name).toBe('Jane Doe');
  });

  it('matches headers case-insensitively and accepts spaced variants', () => {
    const [row] = parseCsv('NAME,Start Date,start_date\nJane Doe,2022-03-14,1999-01-01');

    expect(row.startDate).toBe('2022-03-14');
  });

  it('normalizes friendly status labels and rejects unknown ones', () => {
    const rows = parseCsv('name,status\nA,On Leave\nB,new-hire\nC,vacation');

    expect(rows.map((row) => row.status)).toEqual(['on_leave', 'new_hire', 'vacation']);
    expect(rows[2].errors).toEqual(['Invalid status']);
  });

  it('flags impossible and out-of-range start dates', () => {
    const rows = parseCsv('name,startDate\nA,2023-02-30\nB,03/14/2022\nC,1950-01-01\nD,2022-02-28');

    expect(rows.map((row) => row.isValid)).toEqual([false, false, false, true]);
    expect(rows[0].errors).toEqual(['Invalid start date (use YYYY-MM-DD)']);
  });

  it('reports every problem on a row without repeating cell values', () => {
    const [row] = parseCsv('name,email,status\n,secret@bad,gone');

    expect(row.errors).toEqual(['Missing name', 'Invalid email format', 'Invalid status']);
    expect(row.errors.join(' ')).not.toContain('secret');
  });

  it('flags values longer than the data layer allows', () => {
    const long = 'x'.repeat(201);
    const [row] = parseCsv(`name,role,level,manager\n${long},${long},${long},${long}`);

    expect(row.errors).toEqual([
      'Name is too long',
      'Role is too long',
      'Level is too long',
      'Manager is too long',
    ]);
  });

  it('strips HTML tags from every value', () => {
    const [row] = parseCsv(
      'name,role\n"<script>alert(1)</script>","<b>Lead</b> <img src=x onerror=alert(1)>Eng"',
    );

    expect(row.name).toBe('alert(1)');
    expect(row.role).toBe('Lead Eng');
  });

  it('strips leading formula characters from every value', () => {
    const [row] = parseCsv('name,role,level\n=SUM(A1),"+1+1","@cmd|\' /C calc\'"');

    expect(row.name).toBe('SUM(A1)');
    expect(row.role).toBe('1+1');
    expect(row.level).toBe("cmd|' /C calc'");
  });

  it('rejects files without a name column', () => {
    expect(() => parseCsv('role,level\nEngineer,L5')).toThrow(CsvParseError);
    expect(() => parseCsv('')).toThrow(CSV_PARSE_ERROR);
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rejects a %s header', (header) => {
    expect(() => parseCsv(`name,${header}\nJane,x`)).toThrow(CSV_PARSE_ERROR);
  });

  it('never lets a crafted header reach Object.prototype', () => {
    expect(() => parseCsv('name,__proto__\nJane,polluted')).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects a file with an unterminated quote', () => {
    expect(() => parseCsv('name\n"Jane Doe')).toThrow(CSV_PARSE_ERROR);
  });

  it('allows exactly 500 rows and rejects 501', () => {
    const body = (count: number) =>
      ['name', ...Array.from({ length: count }, (_, index) => `Person ${index}`)].join('\n');

    expect(parseCsv(body(CSV_LIMITS.maxRows))).toHaveLength(CSV_LIMITS.maxRows);
    expect(() => parseCsv(body(CSV_LIMITS.maxRows + 1))).toThrow(CSV_ROW_LIMIT_ERROR);
  });
});

describe('validateRow', () => {
  it('accepts a row with only a name', () => {
    expect(validateRow({ name: 'Jane Doe' })).toEqual({ isValid: true, errors: [] });
  });

  it('treats a missing name key as a missing name', () => {
    expect(validateRow({})).toEqual({ isValid: false, errors: ['Missing name'] });
  });
});

import { MEMBER_LIMITS, isTeamMemberStatus } from '../data/members';
import type { CsvColumn, ParsedRow, ValidationResult } from '../types/CsvImport';
import { stripHtml, validateForm } from './validateMemberForm';

export const CSV_LIMITS = {
  maxBytes: 1024 * 1024,
  maxRows: 500,
} as const;

export const CSV_PARSE_ERROR = 'Could not parse file. Ensure it is a valid CSV.';
export const CSV_ROW_LIMIT_ERROR = `CSV exceeds ${CSV_LIMITS.maxRows} row limit.`;
export const CSV_TYPE_ERROR = 'Please upload a .csv file';
export const CSV_SIZE_ERROR = 'File is too large. The limit is 1 MB.';

export class CsvParseError extends Error {
  constructor(message: string = CSV_PARSE_ERROR) {
    super(message);
    this.name = 'CsvParseError';
  }
}

// Header names are compared lowercase with spaces, dashes and underscores removed.
const HEADER_ALIASES: Record<string, CsvColumn> = {
  name: 'name',
  role: 'role',
  level: 'level',
  startdate: 'startDate',
  email: 'email',
  manager: 'manager',
  status: 'status',
};
const COLUMNS: readonly CsvColumn[] = Object.values(HEADER_ALIASES);
const RESERVED_HEADERS = new Set(['__proto__', 'constructor', 'prototype']);
// Windows often labels .csv files application/vnd.ms-excel; other systems leave the type empty.
const ACCEPTED_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel', '']);
const BOM = '\uFEFF';
const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]+/;
const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Checks the name, type and size before the file is read. `accept=".csv"` is only a UI hint. */
export function validateCsvFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const type = file.type.toLowerCase();
  if (!file.name.toLowerCase().endsWith('.csv') || !ACCEPTED_MIME_TYPES.has(type)) {
    return CSV_TYPE_ERROR;
  }
  if (file.size > CSV_LIMITS.maxBytes) return CSV_SIZE_ERROR;
  return null;
}

/** One pass over the text; handles quoted fields with commas, doubled quotes and line breaks. */
function tokenize(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let atFieldStart = true;

  const endField = () => {
    record.push(field);
    field = '';
    atFieldStart = true;
  };
  const endRecord = () => {
    endField();
    if (record.some((value) => value.trim() !== '')) records.push(record);
    record = [];
    // The header plus the row limit is the most we ever need to read.
    if (records.length > CSV_LIMITS.maxRows + 1) throw new CsvParseError(CSV_ROW_LIMIT_ERROR);
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = false;
      }
    } else if (char === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
    } else if (char === ',') {
      endField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      endRecord();
    } else {
      field += char;
      atFieldStart = false;
    }
  }
  if (inQuotes) throw new CsvParseError();
  if (field !== '' || record.length > 0) endRecord();
  return records;
}

/** Strips HTML tags and leading formula characters (=, +, -, @, tab, CR) from a cell. */
function sanitizeCell(value: string): string {
  return stripHtml(value).replace(FORMULA_PREFIX_PATTERN, '').trim();
}

function normalizeStatus(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isRealDay(value: string): boolean {
  const match = ISO_DAY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    year >= MEMBER_LIMITS.minYear &&
    year <= MEMBER_LIMITS.maxYear
  );
}

/** Applies the same rules as the add-member form and the data layer to one sanitized row. */
export function validateRow(row: Record<string, string>): ValidationResult {
  const errors: string[] = [];
  const name = row.name ?? '';
  const email = row.email ?? '';

  const form = validateForm({ name, email });
  if (form.name) errors.push(name === '' ? 'Missing name' : 'Name is too long');
  if (form.email) {
    errors.push(
      email.length > MEMBER_LIMITS.emailLength ? 'Email is too long' : 'Invalid email format',
    );
  }
  for (const field of ['role', 'level', 'manager'] as const) {
    if ((row[field] ?? '').length > MEMBER_LIMITS.textLength) {
      errors.push(`${field[0].toUpperCase()}${field.slice(1)} is too long`);
    }
  }
  const status = normalizeStatus(row.status ?? '');
  if (status !== '' && !isTeamMemberStatus(status)) errors.push('Invalid status');
  const startDate = row.startDate ?? '';
  if (startDate !== '' && !isRealDay(startDate)) errors.push('Invalid start date (use YYYY-MM-DD)');

  return { isValid: errors.length === 0, errors };
}

function readHeader(record: string[]): Map<number, CsvColumn> {
  const columns = new Map<number, CsvColumn>();
  const seen = new Set<CsvColumn>();
  record.forEach((cell, index) => {
    const label = cell.trim().toLowerCase();
    if (RESERVED_HEADERS.has(label)) throw new CsvParseError();
    const column = HEADER_ALIASES[label.replace(/[\s_-]/g, '')];
    if (column && !seen.has(column)) {
      seen.add(column);
      columns.set(index, column);
    }
  });
  if (!seen.has('name')) throw new CsvParseError();
  return columns;
}

/**
 * Parses CSV text into validated rows. Throws CsvParseError when the file is structurally unusable
 * (no `name` column, unbalanced quotes, a reserved header, too many rows).
 */
export function parseCsv(csvText: string): ParsedRow[] {
  const text = csvText.startsWith(BOM) ? csvText.slice(BOM.length) : csvText;
  const [header, ...records] = tokenize(text);
  if (!header) throw new CsvParseError();
  const columns = readHeader(header);

  return records.map((record) => {
    const raw: Partial<Record<CsvColumn, string>> = {};
    columns.forEach((column, index) => {
      raw[column] = sanitizeCell(record[index] ?? '');
    });
    const values = Object.fromEntries(COLUMNS.map((column) => [column, raw[column] ?? '']));
    const status = values.status === '' ? 'active' : normalizeStatus(values.status);
    const { isValid, errors } = validateRow({ ...values, status });
    return {
      raw,
      name: values.name,
      role: values.role,
      level: values.level,
      startDate: values.startDate,
      email: values.email,
      manager: values.manager,
      status,
      isValid,
      errors,
    };
  });
}

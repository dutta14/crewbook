import type { TeamMember } from '../types/TeamMember';
import { downloadFile } from './downloadFile';

export const CSV_COLUMNS = ['name', 'role', 'level', 'email', 'status'] as const;
export const CSV_UNENCRYPTED_REMINDER = "Remember to delete the export file when you're done";

type RosterRow = Pick<TeamMember, (typeof CSV_COLUMNS)[number]>;

// A leading character that spreadsheets read as the start of a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutralises formulas, then quotes the cell when it holds a comma, quote or line break. */
export function toCsvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * The roster as CSV with only name, role, level, email and status. Nothing else about a person
 * can reach this file, because only those five fields are ever read.
 */
export function buildRosterCsv(members: readonly RosterRow[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const member of members) {
    lines.push(CSV_COLUMNS.map((column) => toCsvCell(String(member[column] ?? ''))).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function rosterFileName(date: Date = new Date()): string {
  return `crewbook-roster-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}

export function exportRosterCsv(members: readonly RosterRow[], date: Date = new Date()): string {
  const fileName = rosterFileName(date);
  // The byte order mark lets Excel read accented names as UTF-8.
  downloadFile(`\uFEFF${buildRosterCsv(members)}`, fileName, 'text/csv;charset=utf-8');
  return fileName;
}

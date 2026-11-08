/** The columns Crewbook reads from an import file. Other columns are ignored. */
export type CsvColumn = 'name' | 'role' | 'level' | 'startDate' | 'email' | 'manager' | 'status';

export interface ValidationResult {
  isValid: boolean;
  /** Short, human-readable problems, e.g. "Missing name". They never repeat the cell value. */
  errors: string[];
}

export interface ParsedRow extends ValidationResult {
  /** Known columns exactly as sanitized from the file (before defaults are applied). */
  raw: Partial<Record<CsvColumn, string>>;
  name: string;
  role: string;
  level: string;
  /** YYYY-MM-DD; empty when the file left it blank. */
  startDate: string;
  email: string;
  /** The manager's name as written in the file. Resolved to an id at import time. */
  manager: string;
  /** A TeamMemberStatus when valid, otherwise whatever the file contained. */
  status: string;
}

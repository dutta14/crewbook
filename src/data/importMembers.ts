import type { ParsedRow } from '../types/CsvImport';
import type { TeamMemberInput } from '../types/TeamMember';
import { toDateInputValue } from '../utils/validateMemberForm';
import { isTeamMemberStatus, listMembers, addMember, type MemberStorage } from './members';

export interface ImportResult {
  imported: number;
  /** Rows that passed preview validation but were rejected when saved. */
  failed: number;
}

const nameKey = (name: string) => name.trim().toLowerCase();

function toInput(row: ParsedRow, manager: string | null): TeamMemberInput | null {
  if (!isTeamMemberStatus(row.status)) return null;
  return {
    name: row.name,
    role: row.role,
    level: row.level,
    startDate: row.startDate || toDateInputValue(new Date()),
    email: row.email,
    manager,
    status: row.status,
    customFields: {},
  };
}

/**
 * Saves each row with addMember, one at a time. A row that fails is counted and skipped; rows
 * already saved stay saved. The `manager` column holds a name: it is linked to an existing member
 * or to a row from the same file (managers are saved first). A name that matches nobody leaves the
 * member without a manager, since a manager often is not on their own roster.
 */
export async function importMembers(
  rows: ParsedRow[],
  storage: MemberStorage,
): Promise<ImportResult> {
  const idsByName = new Map<string, string>();
  for (const member of listMembers(storage)) {
    if (!idsByName.has(nameKey(member.name))) idsByName.set(nameKey(member.name), member.id);
  }

  const result: ImportResult = { imported: 0, failed: 0 };
  const save = async (row: ParsedRow, manager: string | null) => {
    const input = toInput(row, manager);
    try {
      if (!input) throw new Error('Invalid status');
      const member = await addMember(input, storage);
      result.imported += 1;
      if (!idsByName.has(nameKey(member.name))) idsByName.set(nameKey(member.name), member.id);
    } catch {
      result.failed += 1;
    }
  };

  let pending = rows;
  while (pending.length > 0) {
    const waiting: ParsedRow[] = [];
    for (const row of pending) {
      const managerId = idsByName.get(nameKey(row.manager));
      if (row.manager === '' || managerId !== undefined) {
        await save(row, managerId ?? null);
      } else {
        waiting.push(row);
      }
    }
    if (waiting.length === pending.length) {
      for (const row of waiting) await save(row, null);
      break;
    }
    pending = waiting;
  }
  return result;
}

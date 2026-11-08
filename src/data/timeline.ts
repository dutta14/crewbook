import type { ChangedField, MemberChange, TimelineEntry } from '../types/Timeline';
import type { TeamMember } from '../types/TeamMember';
import { toDateAttribute } from '../utils/startDate';

export const MAX_HISTORY_ENTRIES = 100;

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  departing: 'Departing',
  new_hire: 'New Hire',
};

const FIELD_LABELS: Record<ChangedField, string> = {
  name: 'Name',
  role: 'Role',
  level: 'Level',
  startDate: 'Start date',
  email: 'Email',
  manager: 'Manager',
  status: 'Status',
  customFields: 'Custom fields',
};

const statusLabel = (status: string | undefined) =>
  status !== undefined && Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status] : 'Unknown';

const startDay = (startDate: string) =>
  Number.isNaN(new Date(startDate).getTime()) ? startDate : toDateAttribute(startDate);

const sameCustomFields = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

/** Compares two snapshots of a member and returns one change per field that differs. */
export function diffMember(before: TeamMember, after: TeamMember, date: string): MemberChange[] {
  const changes: Array<Omit<MemberChange, 'id' | 'date'>> = [];
  if (before.status !== after.status) {
    changes.push({ field: 'status', from: before.status, to: after.status });
  }
  for (const field of ['name', 'role', 'level', 'email'] as const) {
    if (before[field] !== after[field]) changes.push({ field, to: after[field] });
  }
  if (startDay(before.startDate) !== startDay(after.startDate)) {
    changes.push({ field: 'startDate', to: startDay(after.startDate) });
  }
  if (before.manager !== after.manager) changes.push({ field: 'manager' });
  if (!sameCustomFields(before.customFields, after.customFields)) {
    changes.push({ field: 'customFields' });
  }
  return changes.map((change) => ({ id: crypto.randomUUID(), date, ...change }));
}

function describeChange({ field, from, to }: MemberChange): string {
  switch (field) {
    case 'status':
      return `Status changed from ${statusLabel(from)} to ${statusLabel(to)}`;
    case 'manager':
      return 'Manager changed';
    case 'customFields':
      return 'Custom fields updated';
    case 'email':
      return 'Email updated';
    default:
      return to ? `${FIELD_LABELS[field]} changed to ${to}` : `${FIELD_LABELS[field]} cleared`;
  }
}

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime());

/** Chronological log (oldest first) of when the member was added and every recorded edit. */
export function buildTimeline(member: TeamMember): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  if (isValidDate(member.createdAt)) {
    entries.push({ id: 'created', date: member.createdAt, description: 'Added to team' });
  }
  const history = Array.isArray(member.history) ? member.history : [];
  for (const change of history) {
    if (!isValidDate(change.date) || !Object.hasOwn(FIELD_LABELS, change.field)) continue;
    entries.push({
      id: change.id,
      date: change.date,
      description: describeChange(change),
      field: change.field,
    });
  }
  // Array.sort is stable, so edits made at the same instant keep their recorded order.
  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

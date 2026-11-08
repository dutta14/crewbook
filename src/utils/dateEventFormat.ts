import type { DateEventType } from '../types/dateEvent';

export const DATE_EVENT_LABELS: Record<DateEventType, string> = {
  visa_expiry: 'Visa expiry',
  probation_end: 'Probation end',
  anniversary: 'Work anniversary',
  birthday: 'Birthday',
};

/** Visa and probation dates can have legal or employment consequences, so they are kept off screen. */
export function isSensitiveDateEvent(type: DateEventType): boolean {
  return type === 'visa_expiry' || type === 'probation_end';
}

/** "today", "tomorrow", "next week" or "in 3 days". */
export function describeDaysUntil(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === 7) return 'next week';
  return `in ${days} days`;
}

/** "Alex" for "Alex Chen". Falls back to the whole name when there is nothing to split. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * A line to open a 1:1 with. Only birthdays and anniversaries get one: it carries a name and an
 * event, never a visa or probation detail. Built when it is shown and never stored.
 */
export function buildConversationStarter(
  type: DateEventType,
  name: string,
  daysUntil: number,
  tenureYears?: number,
): string | undefined {
  const when = describeDaysUntil(daysUntil);
  if (type === 'anniversary' && tenureYears !== undefined) {
    return `${firstName(name)}'s ${tenureYears}-year anniversary is ${when}. A good moment to acknowledge their growth.`;
  }
  if (type === 'birthday') {
    return `${firstName(name)}'s birthday is ${when}. A small hello goes a long way.`;
  }
  return undefined;
}

import type { FeedbackEntry } from '../types/feedback';
import { formatShortDate } from './decisionFormat';

const day = (isoDate: string) => formatShortDate(isoDate) ?? isoDate;

/** "1 feedback entry" / "5 feedback entries", for the live region and the page. */
export function describeFeedbackCount(count: number): string {
  return `${count} feedback ${count === 1 ? 'entry' : 'entries'}`;
}

/**
 * Plain text for a promotion write-up, oldest entry first. `entries` is whatever the caller has
 * already limited to positive feedback; this only formats.
 */
export function formatPromoPacket(
  name: string,
  range: { start: string; end: string },
  entries: FeedbackEntry[],
): string {
  const lines = [
    `Promo packet: ${name}`,
    `Positive feedback from ${day(range.start)} to ${day(range.end)}`,
  ];
  if (entries.length === 0)
    return [...lines, '', 'No positive feedback in this period.'].join('\n');
  for (const entry of entries) {
    lines.push('', day(entry.date), entry.text);
    if (entry.tags.length > 0) lines.push(`Tags: ${entry.tags.join(', ')}`);
  }
  return lines.join('\n');
}

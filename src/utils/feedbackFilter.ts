import type { FeedbackEntry, FeedbackFilter } from '../types/feedback';

/** Entries sorted newest first: by day, then by when they were logged. */
export function sortNewestFirst(entries: FeedbackEntry[]): FeedbackEntry[] {
  return entries
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.date !== b.item.date) return a.item.date < b.item.date ? 1 : -1;
      return Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt) || b.index - a.index;
    })
    .map(({ item }) => item);
}

/**
 * Applies every filter that is set. Search is a plain substring match, never a pattern, so a
 * crafted query cannot cost more than a scan. Runs in memory against decrypted entries only.
 */
export function filterFeedback(
  entries: FeedbackEntry[],
  filter: FeedbackFilter = {},
): FeedbackEntry[] {
  const { engineerId, type, tag, dateRange, search } = filter;
  const query = search?.trim().toLowerCase() ?? '';
  const start = dateRange?.start || undefined;
  const end = dateRange?.end || undefined;
  return entries.filter(
    (entry) =>
      (!engineerId || entry.engineerId === engineerId) &&
      (!type || entry.type === type) &&
      (!tag || entry.tags.includes(tag)) &&
      (!start || entry.date >= start) &&
      (!end || entry.date <= end) &&
      (query === '' || entry.text.toLowerCase().includes(query)),
  );
}

/** The distinct tags in use, alphabetically. */
export function collectTags(entries: FeedbackEntry[]): string[] {
  return Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort((a, b) =>
    a.localeCompare(b),
  );
}

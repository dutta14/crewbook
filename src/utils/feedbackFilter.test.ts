import { describe, expect, it } from 'vitest';
import { createFeedback } from '../test-utils/factories';
import { collectTags, filterFeedback, sortNewestFirst } from './feedbackFilter';
import { describeFeedbackCount, formatPromoPacket } from './feedbackFormat';

const entries = [
  createFeedback({
    id: 'a',
    engineerId: 'alex',
    type: 'positive',
    date: '2025-03-10',
    text: 'Great Demo for the launch',
    tags: ['demo', 'leadership'],
  }),
  createFeedback({
    id: 'b',
    engineerId: 'priya',
    type: 'constructive',
    date: '2025-02-01',
    text: 'Interrupted others in planning',
    tags: ['communication'],
  }),
  createFeedback({
    id: 'c',
    engineerId: 'alex',
    type: 'neutral',
    date: '2025-01-15',
    text: 'Asked about the roadmap (v2)',
    tags: [],
  }),
];

const ids = (list: typeof entries) => list.map((item) => item.id);

describe('filterFeedback', () => {
  it('returns everything without a filter', () => {
    expect(ids(filterFeedback(entries))).toEqual(['a', 'b', 'c']);
  });

  it.each([
    ['person', { engineerId: 'alex' }, ['a', 'c']],
    ['type', { type: 'constructive' as const }, ['b']],
    ['tag', { tag: 'demo' }, ['a']],
    ['date range', { dateRange: { start: '2025-02-01', end: '2025-03-10' } }, ['a', 'b']],
    ['open-ended start', { dateRange: { start: '2025-02-02' } }, ['a']],
    ['open-ended end', { dateRange: { end: '2025-01-31' } }, ['c']],
    ['search ignoring case', { search: 'great demo' }, ['a']],
  ])('filters by %s', (_label, filter, expected) => {
    expect(ids(filterFeedback(entries, filter))).toEqual(expected);
  });

  it('combines filters', () => {
    expect(ids(filterFeedback(entries, { engineerId: 'alex', type: 'neutral' }))).toEqual(['c']);
    expect(ids(filterFeedback(entries, { engineerId: 'priya', type: 'positive' }))).toEqual([]);
  });

  it('treats search text as plain text, not a pattern', () => {
    expect(ids(filterFeedback(entries, { search: '(v2)' }))).toEqual(['c']);
    expect(ids(filterFeedback(entries, { search: '.*' }))).toEqual([]);
    expect(ids(filterFeedback(entries, { search: '   ' }))).toEqual(['a', 'b', 'c']);
  });
});

describe('collectTags and sortNewestFirst', () => {
  it('lists distinct tags alphabetically', () => {
    expect(collectTags(entries)).toEqual(['communication', 'demo', 'leadership']);
  });

  it('sorts by day, newest first, without changing the input', () => {
    const input = [entries[2], entries[0], entries[1]];

    expect(ids(sortNewestFirst(input))).toEqual(['a', 'b', 'c']);
    expect(ids(input)).toEqual(['c', 'a', 'b']);
  });
});

describe('formatPromoPacket', () => {
  it('writes a header, then each entry with its date, text and tags', () => {
    const text = formatPromoPacket('Alex Chen', { start: '2025-01-01', end: '2025-03-31' }, [
      entries[0],
      createFeedback({ date: '2025-03-20', text: 'Mentored two interns', tags: [] }),
    ]);

    expect(text).toBe(
      [
        'Promo packet: Alex Chen',
        'Positive feedback from Jan 1, 2025 to Mar 31, 2025',
        '',
        'Mar 10, 2025',
        'Great Demo for the launch',
        'Tags: demo, leadership',
        '',
        'Mar 20, 2025',
        'Mentored two interns',
      ].join('\n'),
    );
  });

  it('says so when there is nothing in the period', () => {
    expect(
      formatPromoPacket('Alex Chen', { start: '2025-01-01', end: '2025-03-31' }, []),
    ).toContain('No positive feedback in this period.');
  });
});

describe('describeFeedbackCount', () => {
  it('pluralises', () => {
    expect(describeFeedbackCount(1)).toBe('1 feedback entry');
    expect(describeFeedbackCount(5)).toBe('5 feedback entries');
    expect(describeFeedbackCount(0)).toBe('0 feedback entries');
  });
});

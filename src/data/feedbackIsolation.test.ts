import { describe, expect, it } from 'vitest';

/*
 * Feedback is the manager's private assessment of a person. The only code allowed to know it
 * exists is the feedback feature itself and the screens that open it. Anything else (sharing,
 * export, summaries, search across data) importing it would be a way for it to leave, so adding
 * such an import must be a deliberate edit to this list, in review.
 */
const FEEDBACK_MODULE =
  /from\s+['"][^'"]*\/(feedbackStore|useFeedback|useFeedbackQuickAdd|useFeedbackCount)['"]/;

const ALLOWED_IMPORTERS = new Set([
  'src/components/FeedbackFab.tsx',
  'src/components/FeedbackLog.tsx',
  'src/components/FeedbackModal.tsx',
  'src/components/FeedbackTagInput.tsx',
  'src/components/FeedbackTypeControl.tsx',
  'src/components/FeedbackEntryCard.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Profile.tsx',
  'src/pages/Roster.tsx',
  'src/hooks/useFeedback.ts',
  'src/hooks/useFeedbackCount.ts',
  'src/hooks/useFeedbackQuickAdd.tsx',
  'src/components/FeedbackFilters.tsx',
  'src/components/PromoPacketMode.tsx',
]);

const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('feedback isolation', () => {
  it('is only imported by the feedback feature and the screens that open it', () => {
    const importers = Object.entries(sources)
      .filter(([, code]) => FEEDBACK_MODULE.test(code))
      .map(([path]) => path.replace(/^\//, ''))
      .filter((path) => !ALLOWED_IMPORTERS.has(path));

    expect(importers).toEqual([]);
  });

  it('is not referenced by any share, export or import code', () => {
    const risky = Object.entries(sources).filter(
      ([path]) =>
        /(share|export|import|summary|csv|backup)/i.test(path) && !/Feedback|feedback/.test(path),
    );

    expect(risky.length).toBeGreaterThan(0);
    for (const [path, code] of risky) {
      expect(code, path).not.toMatch(/feedback/i);
    }
  });
});

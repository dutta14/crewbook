import { describe, expect, it } from 'vitest';
import { createGrowthEntry } from '../test-utils/factories';
import { deriveCurrentLevel, describeChange, formatGrowthSummary } from './growthFormat';

describe('deriveCurrentLevel', () => {
  it('uses the to of the latest entry', () => {
    const entries = [
      createGrowthEntry({ to: 'L6' }),
      createGrowthEntry({ to: 'L5', date: '2024-01-01' }),
    ];

    expect(deriveCurrentLevel(entries)).toBe('L6');
  });

  it('skips team transfers and entries with nothing in to', () => {
    const entries = [
      createGrowthEntry({ changeType: 'team_transfer', to: 'Platform' }),
      createGrowthEntry({ changeType: 'title_update', to: '' }),
      createGrowthEntry({ to: 'L5' }),
    ];

    expect(deriveCurrentLevel(entries)).toBe('L5');
  });

  it('is null when there is nothing to derive it from', () => {
    expect(deriveCurrentLevel([])).toBeNull();
    expect(deriveCurrentLevel([createGrowthEntry({ changeType: 'team_transfer' })])).toBeNull();
  });
});

describe('describeChange', () => {
  it.each([
    [{ from: 'L4', to: 'L5' }, 'L4 → L5'],
    [{ from: '', to: 'L5' }, 'L5'],
    [{ from: 'L4', to: '' }, 'L4 →'],
    [{ from: '', to: '' }, null],
  ])('describes %j', (entry, expected) => {
    expect(describeChange(entry)).toBe(expected);
  });

  it('can use a plain-text arrow', () => {
    expect(describeChange({ from: 'L4', to: 'L5' }, '->')).toBe('L4 -> L5');
  });
});

describe('formatGrowthSummary', () => {
  it('lists entries oldest first with the current level and notes', () => {
    const entries = [
      createGrowthEntry({ date: '2025-03-03', from: 'L4', to: 'L5', notes: 'Led payments' }),
      createGrowthEntry({
        date: '2023-01-10',
        changeType: 'team_transfer',
        from: '',
        to: 'Platform',
        notes: '',
      }),
      createGrowthEntry({
        date: '2022-05-01',
        changeType: 'title_update',
        from: '',
        to: '',
        notes: '',
      }),
    ];

    expect(formatGrowthSummary('Alex Chen', 'L5', entries)).toBe(
      [
        'Growth history: Alex Chen',
        'Current level/role: L5',
        '',
        'May 1, 2022 - Title update',
        '',
        'Jan 10, 2023 - Team transfer: Platform',
        '',
        'Mar 3, 2025 - Promotion: L4 -> L5',
        'Notes: Led payments',
      ].join('\n'),
    );
  });

  it('leaves out the current level when there is none', () => {
    expect(formatGrowthSummary('Alex Chen', null, [])).toBe('Growth history: Alex Chen');
  });
});

import { describe, expect, it } from 'vitest';
import { createMember } from '../test-utils/factories';
import type { CustomFieldDefinition } from '../types/customField';
import { dateFilterKey, matchesCustomFieldFilters } from './customFieldFilter';

const text: CustomFieldDefinition = { id: 'team', name: 'Team', type: 'text', order: 0 };
const size: CustomFieldDefinition = {
  id: 'size',
  name: 'Size',
  type: 'select',
  options: ['S', 'L'],
  order: 1,
};
const day: CustomFieldDefinition = { id: 'day', name: 'Day', type: 'date', order: 2 };
const defs = [text, size, day];

const member = (customFields: Record<string, string>) => createMember({ customFields });

describe('matchesCustomFieldFilters', () => {
  it('matches everyone when no filter is set', () => {
    expect(matchesCustomFieldFilters(member({}), defs, {})).toBe(true);
    expect(matchesCustomFieldFilters(member({}), defs, { team: '  ' })).toBe(true);
  });

  it('matches text by case-insensitive substring and excludes members without a value', () => {
    expect(matchesCustomFieldFilters(member({ team: 'Payments' }), defs, { team: 'pay' })).toBe(
      true,
    );
    expect(matchesCustomFieldFilters(member({ team: 'Search' }), defs, { team: 'pay' })).toBe(
      false,
    );
    expect(matchesCustomFieldFilters(member({}), defs, { team: 'pay' })).toBe(false);
  });

  it('matches a select exactly', () => {
    expect(matchesCustomFieldFilters(member({ size: 'S' }), defs, { size: 'S' })).toBe(true);
    expect(matchesCustomFieldFilters(member({ size: 'L' }), defs, { size: 'S' })).toBe(false);
  });

  it('matches a date range inclusively, with either end optional', () => {
    const from = dateFilterKey('day', 'from');
    const to = dateFilterKey('day', 'to');
    const inRange = member({ day: '2024-05-10' });

    expect(matchesCustomFieldFilters(inRange, defs, { [from]: '2024-05-10' })).toBe(true);
    expect(matchesCustomFieldFilters(inRange, defs, { [to]: '2024-05-09' })).toBe(false);
    expect(
      matchesCustomFieldFilters(inRange, defs, { [from]: '2024-05-01', [to]: '2024-05-31' }),
    ).toBe(true);
    expect(matchesCustomFieldFilters(member({}), defs, { [from]: '2024-05-01' })).toBe(false);
  });

  it('requires every active filter to match', () => {
    const both = member({ team: 'Payments', size: 'L' });

    expect(matchesCustomFieldFilters(both, defs, { team: 'pay', size: 'L' })).toBe(true);
    expect(matchesCustomFieldFilters(both, defs, { team: 'pay', size: 'S' })).toBe(false);
  });
});

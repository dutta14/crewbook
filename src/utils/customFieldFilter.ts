import type { CustomFieldDefinition } from '../types/customField';
import type { TeamMember } from '../types/TeamMember';

/** Active filters by key: `fieldId`, or `fieldId:from` and `fieldId:to` for a date range. */
export type CustomFieldFilterValues = Readonly<Record<string, string>>;

export const dateFilterKey = (fieldId: string, edge: 'from' | 'to') => `${fieldId}:${edge}`;

export function hasActiveCustomFieldFilters(filters: CustomFieldFilterValues): boolean {
  return Object.values(filters).some((value) => value !== '');
}

function matchesField(
  field: CustomFieldDefinition,
  value: string,
  filters: CustomFieldFilterValues,
): boolean {
  switch (field.type) {
    case 'text':
    case 'url': {
      const query = (filters[field.id] ?? '').trim().toLowerCase();
      return query === '' || value.toLowerCase().includes(query);
    }
    case 'select': {
      const wanted = filters[field.id] ?? '';
      return wanted === '' || value === wanted;
    }
    case 'date': {
      const from = filters[dateFilterKey(field.id, 'from')] ?? '';
      const to = filters[dateFilterKey(field.id, 'to')] ?? '';
      if (from === '' && to === '') return true;
      // Stored dates are YYYY-MM-DD, which sort as text.
      return value !== '' && (from === '' || value >= from) && (to === '' || value <= to);
    }
  }
}

/** A member matches when every active filter matches; a member without a value fails an active one. */
export function matchesCustomFieldFilters(
  member: TeamMember,
  definitions: readonly CustomFieldDefinition[],
  filters: CustomFieldFilterValues,
): boolean {
  const values = member.customFields ?? {};
  return definitions.every((field) =>
    matchesField(field, Object.hasOwn(values, field.id) ? values[field.id] : '', filters),
  );
}

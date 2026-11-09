import type { CustomFieldDefinition } from '../types/customField';
import {
  dateFilterKey,
  hasActiveCustomFieldFilters,
  type CustomFieldFilterValues,
} from '../utils/customFieldFilter';
import '../styles/button.css';
import '../styles/custom-fields.css';
import '../styles/form.css';

interface CustomFieldFiltersProps {
  definitions: readonly CustomFieldDefinition[];
  filters: CustomFieldFilterValues;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}

export function CustomFieldFilters({
  definitions,
  filters,
  onChange,
  onClear,
}: CustomFieldFiltersProps) {
  if (definitions.length === 0) return null;

  const control = (key: string, label: string, kind: 'text' | 'date') => (
    <div className="custom-field-filter" key={key}>
      <label className="custom-field-filter__label" htmlFor={`roster-cf-${key}`}>
        {label}
      </label>
      <input
        id={`roster-cf-${key}`}
        type={kind}
        className="form-input"
        autoComplete="off"
        value={filters[key] ?? ''}
        onChange={(event) => onChange(key, event.target.value)}
      />
    </div>
  );

  return (
    <div className="custom-field-filters" role="group" aria-label="Filter by custom fields">
      {definitions.map((field) => {
        if (field.type === 'select') {
          const id = `roster-cf-${field.id}`;
          return (
            <div className="custom-field-filter" key={field.id}>
              <label className="custom-field-filter__label" htmlFor={id}>
                {field.name}
              </label>
              <select
                id={id}
                className="form-input"
                value={filters[field.id] ?? ''}
                onChange={(event) => onChange(field.id, event.target.value)}
              >
                <option value="">Any</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (field.type === 'date') {
          return [
            control(dateFilterKey(field.id, 'from'), `${field.name} from`, 'date'),
            control(dateFilterKey(field.id, 'to'), `${field.name} to`, 'date'),
          ];
        }
        return control(field.id, field.name, 'text');
      })}
      {hasActiveCustomFieldFilters(filters) ? (
        <button type="button" className="btn btn-secondary" onClick={onClear}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

import { formatStartDate, toDateAttribute } from '../utils/startDate';
import type { CustomFieldDefinition } from '../types/customField';
import '../styles/custom-fields.css';

interface CustomFieldDisplayProps {
  definitions: readonly CustomFieldDefinition[];
  /** Field id to stored value. A missing or empty value shows as not set. */
  values: Readonly<Record<string, string>>;
}

function FieldValue({ field, value }: { field: CustomFieldDefinition; value: string }) {
  if (value === '') {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not set</span>
      </>
    );
  }
  if (field.type === 'url') {
    return (
      <a className="profile-link" href={value} target="_blank" rel="noopener noreferrer">
        {value} <span className="sr-only">(opens in new tab)</span>
      </a>
    );
  }
  if (field.type === 'date') {
    const formatted = formatStartDate(value);
    return formatted ? <time dateTime={toDateAttribute(value)}>{formatted}</time> : <>{value}</>;
  }
  return <>{value}</>;
}

/** Renders values as text only, so a stored value can never become markup. */
export function CustomFieldDisplay({ definitions, values }: CustomFieldDisplayProps) {
  if (definitions.length === 0) return null;

  return (
    <section className="custom-field-display" aria-labelledby="profile-custom-fields-heading">
      <h2 id="profile-custom-fields-heading" className="custom-field-display__title">
        Custom fields
      </h2>
      <dl className="profile-fields">
        {definitions.map((field) => (
          <div key={field.id} className="profile-field">
            <dt className="profile-field__label">{field.name}</dt>
            <dd className="profile-field__value">
              <FieldValue
                field={field}
                value={Object.hasOwn(values, field.id) ? values[field.id] : ''}
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

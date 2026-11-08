import { useId } from 'react';
import type { ParsedRow } from '../types/CsvImport';

export interface CsvPreviewTableProps {
  rows: ParsedRow[];
  selected: ReadonlySet<number>;
  onToggle: (index: number) => void;
}

/** Every cell is rendered as React text, never as HTML. */
export function CsvPreviewTable({ rows, selected, onToggle }: CsvPreviewTableProps) {
  const prefix = useId();
  return (
    // A horizontally scrolling region must be focusable so keyboard users can scroll it.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="csv-preview" role="region" aria-label="CSV preview rows" tabIndex={0}>
      <table className="csv-preview__table">
        <caption>
          CSV preview: {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Select</span>
            </th>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">Level</th>
            <th scope="col">Email</th>
            <th scope="col">Status</th>
            <th scope="col">Validation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const problemId = `${prefix}-problem-${index}`;
            return (
              <tr
                // Rows never reorder, so the index is a stable key.
                key={index}
                className="csv-preview__row"
                data-testid="csv-preview-row"
                data-valid={row.isValid}
                data-selected={selected.has(index)}
              >
                <td>
                  <label className="csv-check">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.name || `row ${index + 1}`} for import`}
                      aria-describedby={row.isValid ? undefined : problemId}
                      checked={selected.has(index)}
                      disabled={!row.isValid}
                      onChange={() => onToggle(index)}
                    />
                  </label>
                </td>
                <td>{row.name || <span className="csv-preview__blank">(blank)</span>}</td>
                <td>{row.role}</td>
                <td>{row.level}</td>
                <td>{row.email}</td>
                <td>{row.status}</td>
                <td id={problemId}>
                  {row.isValid ? (
                    <span className="csv-preview__ok">Valid</span>
                  ) : (
                    <span className="csv-preview__problem">{row.errors.join('. ')}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const CSV_TEMPLATE_FILENAME = 'crewbook-team-template.csv';

// Placeholder people only. No real team data ever goes in here.
export const CSV_TEMPLATE = [
  'name,role,level,startDate,email,manager,status',
  'Jane Doe,Software Engineer,L5,2022-03-14,jane.doe@example.com,,active',
  'John Smith,Product Designer,L4,2023-08-01,john.smith@example.com,Jane Doe,new_hire',
  '',
].join('\n');

const REVOKE_DELAY_MS = 1000;

/** Builds the template Blob on demand, downloads it, then releases the object URL. */
export function downloadCsvTemplate(): void {
  const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = CSV_TEMPLATE_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

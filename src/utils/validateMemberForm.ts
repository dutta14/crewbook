import type { TeamMemberInput } from '../types/TeamMember';

export interface FormErrors {
  name?: string;
  email?: string;
  startDate?: string;
  departureDate?: string;
}

export const FORM_LIMITS = {
  name: 200,
  shortText: 100,
  email: 254,
  maxYearsPast: 1,
  maxYearsFuture: 5,
} as const;

// UX check only. Stricter than a bare shape test so it also matches what the data layer accepts.
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HTML_TAG_PATTERN = /<\/?[a-z!?][^>]*>?/gi;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Removes anything that looks like an HTML tag, then trims. */
export function stripHtml(value: string): string {
  return value.replace(HTML_TAG_PATTERN, '').trim();
}

/** YYYY-MM-DD for a local calendar day. */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isRealDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateStartDate(startDate: string, now: Date): string | undefined {
  if (startDate === '') return undefined;
  if (!isRealDate(startDate)) return 'Enter a valid start date.';
  const earliest = new Date(
    now.getFullYear() - FORM_LIMITS.maxYearsPast,
    now.getMonth(),
    now.getDate(),
  );
  const latest = new Date(
    now.getFullYear() + FORM_LIMITS.maxYearsFuture,
    now.getMonth(),
    now.getDate(),
  );
  // ISO dates sort lexically, so string comparison is a calendar comparison.
  if (startDate < toDateInputValue(earliest)) {
    return 'Start date can’t be more than a year ago.';
  }
  if (startDate > toDateInputValue(latest)) {
    return 'Start date can’t be more than 5 years from now.';
  }
  return undefined;
}

export interface ValidateOptions {
  now?: Date;
  /** An existing member's start date; leaving it untouched is never an error, however old. */
  originalStartDate?: string;
}

export function validateForm(
  values: Partial<Pick<TeamMemberInput, 'name' | 'email' | 'startDate' | 'departureDate'>>,
  { now = new Date(), originalStartDate }: ValidateOptions = {},
): FormErrors {
  const errors: FormErrors = {};

  const name = stripHtml(values.name ?? '');
  if (name === '') {
    errors.name = 'Enter a name.';
  } else if (name.length > FORM_LIMITS.name) {
    errors.name = `Name must be ${FORM_LIMITS.name} characters or fewer.`;
  }

  const email = (values.email ?? '').trim();
  if (email.length > FORM_LIMITS.email) {
    errors.email = `Email must be ${FORM_LIMITS.email} characters or fewer.`;
  } else if (email !== '' && !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter an email like name@example.com.';
  }

  const startDate = (values.startDate ?? '').trim();
  const startDateError =
    startDate === originalStartDate ? undefined : validateStartDate(startDate, now);
  if (startDateError) errors.startDate = startDateError;

  const departureDate = (values.departureDate ?? '').trim();
  if (departureDate !== '') {
    if (!isRealDate(departureDate)) {
      errors.departureDate = 'Enter a valid departure date.';
    } else if (startDate !== '' && isRealDate(startDate) && departureDate < startDate) {
      errors.departureDate = 'Departure date can’t be before the start date.';
    }
  }

  return errors;
}

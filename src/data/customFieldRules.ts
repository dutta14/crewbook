import type {
  CustomFieldDefinition,
  CustomFieldInput,
  CustomFieldType,
} from '../types/customField';
import { URL_MAX_LENGTH, normalizeExternalUrl } from '../utils/externalUrl';
import { parseIsoDate } from '../utils/scheduleCalculator';
import { ValidationError } from './errors';

/** A property on the decrypted `crewbook_data` object, next to `members`. */
export const CUSTOM_FIELDS_STORAGE_KEY = 'customFieldDefinitions';

export const CUSTOM_FIELD_LIMITS = {
  count: 10,
  nameLength: 50,
  optionCount: 50,
  optionLength: 100,
  textValueLength: 500,
} as const;

export const CUSTOM_FIELD_TYPES: readonly CustomFieldType[] = ['text', 'date', 'select', 'url'];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  date: 'Date',
  select: 'Select',
  url: 'URL',
};

export const INVALID_FIELD_URL_MESSAGE = 'Enter a link that starts with https:// or http://';

export const HTML_TAG_PATTERN = /<\/?[a-z!?]/i;
const FIELD_ID_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCustomFieldType(value: unknown): value is CustomFieldType {
  return typeof value === 'string' && (CUSTOM_FIELD_TYPES as readonly string[]).includes(value);
}

export function cleanFieldName(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Enter a field name');
  const name = value.trim();
  if (name === '') throw new ValidationError('Enter a field name');
  if (name.length > CUSTOM_FIELD_LIMITS.nameLength) {
    throw new ValidationError(
      `Field name must be ${CUSTOM_FIELD_LIMITS.nameLength} characters or fewer`,
    );
  }
  if (HTML_TAG_PATTERN.test(name)) throw new ValidationError('Field name must not contain HTML');
  return name;
}

/** Blank lines are ignored and repeats (ignoring case) are dropped. */
export function cleanOptions(value: unknown): string[] {
  if (!Array.isArray(value)) throw new ValidationError('Add at least one option');
  const seen = new Set<string>();
  const options: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') throw new ValidationError('Options must be text');
    const option = entry.trim();
    if (option === '') continue;
    if (option.length > CUSTOM_FIELD_LIMITS.optionLength) {
      throw new ValidationError(
        `Each option must be ${CUSTOM_FIELD_LIMITS.optionLength} characters or fewer`,
      );
    }
    if (HTML_TAG_PATTERN.test(option)) throw new ValidationError('Options must not contain HTML');
    const key = option.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }
  if (options.length === 0) throw new ValidationError('Add at least one option');
  if (options.length > CUSTOM_FIELD_LIMITS.optionCount) {
    throw new ValidationError(`Add at most ${CUSTOM_FIELD_LIMITS.optionCount} options`);
  }
  return options;
}

/**
 * Checks and copies a definition's editable fields. `editingId` leaves that field out of the
 * duplicate-name check so it can keep its own name.
 */
export function cleanFieldInput(
  input: CustomFieldInput,
  existing: readonly CustomFieldDefinition[],
  editingId?: string,
): CustomFieldInput {
  const name = cleanFieldName(input.name);
  if (!isCustomFieldType(input.type)) throw new ValidationError('Field type is not valid');
  const key = name.toLowerCase();
  if (existing.some((field) => field.id !== editingId && field.name.toLowerCase() === key)) {
    throw new ValidationError('A field with that name already exists');
  }
  return input.type === 'select'
    ? { name, type: input.type, options: cleanOptions(input.options) }
    : { name, type: input.type };
}

/**
 * The stored definitions that are well-formed, in display order and renumbered from 0. Anything
 * damaged or beyond the limit is dropped, so a tampered store cannot add a field or a type.
 */
export function parseDefinitions(stored: unknown): CustomFieldDefinition[] {
  if (!Array.isArray(stored)) return [];
  const parsed: CustomFieldDefinition[] = [];
  for (const item of stored) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, name, type, options, order } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !FIELD_ID_PATTERN.test(id)) continue;
    if (parsed.some((field) => field.id === id)) continue;
    try {
      const clean = cleanFieldInput(
        { name: name as string, type: type as CustomFieldType, options: options as string[] },
        [],
      );
      parsed.push({ ...clean, id, order: typeof order === 'number' ? order : parsed.length });
    } catch {
      // A damaged definition is left out; its values are cleaned up as orphans.
    }
  }
  return parsed
    .sort((a, b) => a.order - b.order)
    .slice(0, CUSTOM_FIELD_LIMITS.count)
    .map((field, index) => ({ ...field, order: index }));
}

/** The text to store for one value: trimmed, and empty when the field is not filled in. */
export function cleanFieldValue(definition: CustomFieldDefinition, raw: unknown): string {
  if (typeof raw !== 'string') throw new ValidationError('Enter text');
  const value = raw.trim();
  if (value === '') return '';
  switch (definition.type) {
    case 'text':
      if (value.length > CUSTOM_FIELD_LIMITS.textValueLength) {
        throw new ValidationError(
          `Must be ${CUSTOM_FIELD_LIMITS.textValueLength} characters or fewer`,
        );
      }
      if (HTML_TAG_PATTERN.test(value)) throw new ValidationError('Must not contain HTML');
      return value;
    case 'url': {
      if (value.length > URL_MAX_LENGTH) {
        throw new ValidationError(`Must be ${URL_MAX_LENGTH} characters or fewer`);
      }
      const href = normalizeExternalUrl(value);
      if (href === null) throw new ValidationError(INVALID_FIELD_URL_MESSAGE);
      return href;
    }
    case 'date':
      if (!DATE_VALUE_PATTERN.test(value) || parseIsoDate(value) === null) {
        throw new ValidationError('Enter a valid date');
      }
      return value;
    case 'select':
      if (!definition.options?.includes(value)) {
        throw new ValidationError('Choose one of the listed options');
      }
      return value;
  }
}

/**
 * Validates the values that belong to a defined field and drops the empty ones. A key with no
 * definition is passed through untouched; the orphan cleanup removes it.
 */
export function cleanDefinedValues(
  values: Record<string, string>,
  definitions: readonly CustomFieldDefinition[],
): Record<string, string> {
  const byId = new Map(definitions.map((field) => [field.id, field]));
  const cleaned: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    const definition = byId.get(key);
    if (!definition) {
      cleaned[key] = raw;
      continue;
    }
    let value: string;
    try {
      value = cleanFieldValue(definition, raw);
    } catch (error) {
      throw new ValidationError(
        `${definition.name}: ${error instanceof ValidationError ? error.message : 'not valid'}`,
      );
    }
    if (value !== '') cleaned[key] = value;
  }
  return cleaned;
}

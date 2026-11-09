/**
 * Small strict-validation toolkit for data that arrives from outside the app (a backup file).
 * Every check returns a fresh, cleaned value and throws a FieldIssue on the first problem. Nothing
 * here ever puts the offending value into a message, only the name of the field.
 */

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

/** One bad field. The collection helpers below turn it into a located BackupValidationError. */
export class FieldIssue extends Error {
  readonly field: string;

  constructor(field: string) {
    super(`Invalid field '${field}'`);
    this.name = 'FieldIssue';
    this.field = field;
  }
}

export type Check<T> = (value: unknown) => T;

export interface Field<T> {
  check: Check<T>;
  optional: boolean;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const HTML_PATTERN = /<\/?[a-z!?]/i;

/** Only the names of fields are ever reported, and only when they are plainly safe to show. */
function safeName(name: string): string {
  return /^[A-Za-z0-9_.-]{1,40}$/.test(name) ? name : 'unknown';
}

export function hasControlCharacter(value: string, allowLineBreaks: boolean): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isBreak = code === 9 || code === 10 || code === 13;
    if ((code < 32 && !(allowLineBreaks && isBreak)) || code === 127) return true;
  }
  return false;
}

export interface StringOptions {
  max: number;
  min?: number;
  pattern?: RegExp;
  noHtml?: boolean;
  multiline?: boolean;
}

export function str(options: StringOptions): Check<string> {
  const { max, min = 0, pattern, noHtml = false, multiline = false } = options;
  return (value) => {
    if (typeof value !== 'string') throw new FieldIssue('');
    if (value.length < min || value.length > max) throw new FieldIssue('');
    if (hasControlCharacter(value, multiline)) throw new FieldIssue('');
    if (noHtml && HTML_PATTERN.test(value)) throw new FieldIssue('');
    if (pattern && !pattern.test(value)) throw new FieldIssue('');
    return value;
  };
}

export function oneOf<T extends string>(allowed: readonly T[]): Check<T> {
  return (value) => {
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
      return value as T;
    }
    throw new FieldIssue('');
  };
}

export function literal<T extends string>(expected: T): Check<T> {
  return oneOf([expected]);
}

export const bool: Check<boolean> = (value) => {
  if (typeof value !== 'boolean') throw new FieldIssue('');
  return value;
};

export function int(min: number, max: number): Check<number> {
  return (value) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw new FieldIssue('');
    }
    return value;
  };
}

/** A real calendar date, `YYYY-MM-DD` or a full ISO timestamp, within a sane range of years. */
export const isoDate: Check<string> = (value) => {
  if (typeof value !== 'string' || value.length > 40) throw new FieldIssue('');
  const match = ISO_PATTERN.exec(value);
  if (!match) throw new FieldIssue('');
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < MIN_YEAR || year > MAX_YEAR) throw new FieldIssue('');
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) throw new FieldIssue('');
  return value;
};

export const clockTime: Check<string> = str({ max: 5, pattern: TIME_PATTERN });

export function nullable<T>(check: Check<T>): Check<T | null> {
  return (value) => (value === null ? null : check(value));
}

/** The empty string or whatever the inner check accepts. */
export function orEmpty(check: Check<string>): Check<string> {
  return (value) => (value === '' ? '' : check(value));
}

export function required<T>(check: Check<T>): Field<T> {
  return { check, optional: false };
}

export function optional<T>(check: Check<T>): Field<T | undefined> {
  return { check, optional: true };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export type Shape<T> = { [K in keyof T]-?: Field<T[K]> };

/** An exact record: unknown fields are refused, missing required fields are refused. */
export function record<T extends object>(shape: Shape<T>): Check<T> {
  const entries = Object.entries(shape) as Array<[string, Field<unknown>]>;
  const known = new Set(entries.map(([name]) => name));
  return (value) => {
    if (!isPlainObject(value)) throw new FieldIssue('');
    for (const name of Object.keys(value)) {
      if (!known.has(name)) throw new FieldIssue('');
    }
    const clean: Record<string, unknown> = {};
    for (const [name, field] of entries) {
      if (!Object.hasOwn(value, name)) {
        if (field.optional) continue;
        throw new FieldIssue(name);
      }
      try {
        clean[name] = field.check(value[name]);
      } catch (error) {
        if (!(error instanceof FieldIssue)) throw error;
        throw new FieldIssue(error.field === '' ? name : `${name}.${error.field}`);
      }
    }
    return clean as T;
  };
}

/** A map from a safe key to a checked value, with a cap on the number of keys. */
export function dictionary<T>(
  keyCheck: Check<string>,
  valueCheck: Check<T>,
  maxKeys: number,
): Check<Record<string, T>> {
  return (value) => {
    if (!isPlainObject(value)) throw new FieldIssue('');
    const keys = Object.keys(value);
    if (keys.length > maxKeys) throw new FieldIssue('');
    const clean: Record<string, T> = Object.create(null) as Record<string, T>;
    for (const key of keys) {
      try {
        keyCheck(key);
        clean[key] = valueCheck(value[key]);
      } catch (error) {
        if (!(error instanceof FieldIssue)) throw error;
        throw new FieldIssue(safeName(key));
      }
    }
    return { ...clean };
  };
}

export function listOf<T>(check: Check<T>, maxItems: number): Check<T[]> {
  return (value) => {
    if (!Array.isArray(value) || value.length > maxItems) throw new FieldIssue('');
    return value.map((item) => check(item));
  };
}

/**
 * Checks each item of a top-level collection and reports the first failure with its position,
 * for example "Invalid field 'name' in team member at index 3".
 */
export function collectionOf<T>(label: string, check: Check<T>, maxItems: number): Check<T[]> {
  return (value) => {
    if (!Array.isArray(value)) throw new BackupValidationError(`${label} must be a list`);
    if (value.length > maxItems) {
      throw new BackupValidationError(`Too many ${label} entries (the limit is ${maxItems})`);
    }
    return value.map((item, index) => {
      try {
        return check(item);
      } catch (error) {
        if (!(error instanceof FieldIssue)) throw error;
        const where = `in ${label} at index ${index}`;
        throw new BackupValidationError(
          error.field === '' ? `Invalid entry ${where}` : `Invalid field '${error.field}' ${where}`,
        );
      }
    });
  };
}

/** Rejects `__proto__`, `constructor` and `prototype` keys anywhere in parsed JSON. */
export function assertNoReservedKeys(root: unknown): void {
  const stack: unknown[] = [root];
  let visited = 0;
  while (stack.length > 0) {
    const node = stack.pop();
    visited += 1;
    if (visited > 2_000_000) throw new BackupValidationError('The backup is too complex');
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
    } else if (typeof node === 'object' && node !== null) {
      for (const key of Object.keys(node)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          throw new BackupValidationError('The backup contains a reserved key');
        }
        stack.push((node as Record<string, unknown>)[key]);
      }
    }
  }
}

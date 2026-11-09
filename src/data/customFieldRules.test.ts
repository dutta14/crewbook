import { describe, expect, it } from 'vitest';
import type { CustomFieldDefinition } from '../types/customField';
import {
  CUSTOM_FIELD_LIMITS,
  cleanDefinedValues,
  cleanFieldInput,
  cleanFieldValue,
  cleanOptions,
  parseDefinitions,
} from './customFieldRules';
import { ValidationError } from './errors';

const def = (overrides: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition => ({
  id: 'field-1',
  name: 'Field',
  type: 'text',
  order: 0,
  ...overrides,
});

describe('cleanFieldInput', () => {
  it('trims the name and keeps options only for a select', () => {
    expect(cleanFieldInput({ name: '  Team  ', type: 'text', options: ['x'] }, [])).toEqual({
      name: 'Team',
      type: 'text',
    });
    expect(cleanFieldInput({ name: 'Size', type: 'select', options: [' S ', 'M'] }, [])).toEqual({
      name: 'Size',
      type: 'select',
      options: ['S', 'M'],
    });
  });

  it.each([
    ['', 'Enter a field name'],
    ['   ', 'Enter a field name'],
    ['x'.repeat(51), '50 characters'],
    ['<b>Team</b>', 'must not contain HTML'],
  ])('rejects the name %j', (name, message) => {
    expect(() => cleanFieldInput({ name, type: 'text' }, [])).toThrow(message);
  });

  it('rejects a duplicate name ignoring case, but lets a field keep its own name', () => {
    const existing = [def({ id: 'a', name: 'Team' })];

    expect(() => cleanFieldInput({ name: 'team', type: 'text' }, existing)).toThrow(
      'already exists',
    );
    expect(cleanFieldInput({ name: 'team', type: 'text' }, existing, 'a').name).toBe('team');
  });

  it('rejects an unknown type', () => {
    expect(() => cleanFieldInput({ name: 'A', type: 'number' as never }, [])).toThrow(
      ValidationError,
    );
  });
});

describe('cleanOptions', () => {
  it('drops blanks and repeats ignoring case', () => {
    expect(cleanOptions(['Red', ' ', 'red', 'Blue'])).toEqual(['Red', 'Blue']);
  });

  it.each([
    [[], 'Add at least one option'],
    [[' '], 'Add at least one option'],
    [['x'.repeat(101)], '100 characters'],
    [['<script>'], 'must not contain HTML'],
    [Array.from({ length: 51 }, (_, index) => `o${index}`), 'at most 50'],
    [[5], 'must be text'],
  ])('rejects %j', (options, message) => {
    expect(() => cleanOptions(options)).toThrow(message);
  });
});

describe('parseDefinitions', () => {
  it('returns nothing for stored data that is not a list', () => {
    expect(parseDefinitions(null)).toEqual([]);
    expect(parseDefinitions({})).toEqual([]);
  });

  it('sorts by order, renumbers and drops damaged or repeated entries', () => {
    const parsed = parseDefinitions([
      { id: 'b', name: 'B', type: 'text', order: 5 },
      { id: 'a', name: 'A', type: 'date', order: 1 },
      { id: 'a', name: 'Again', type: 'text', order: 2 },
      { id: 'bad id', name: 'C', type: 'text', order: 3 },
      { id: 'c', name: '<i>C</i>', type: 'text', order: 4 },
      { id: 'd', name: 'D', type: 'number', order: 6 },
      null,
      'text',
    ]);

    expect(parsed).toEqual([
      { id: 'a', name: 'A', type: 'date', order: 0 },
      { id: 'b', name: 'B', type: 'text', order: 1 },
    ]);
  });

  it('keeps at most ten fields', () => {
    const stored = Array.from({ length: 12 }, (_, index) => ({
      id: `f${index}`,
      name: `F${index}`,
      type: 'text',
      order: index,
    }));

    expect(parseDefinitions(stored)).toHaveLength(CUSTOM_FIELD_LIMITS.count);
  });
});

describe('cleanFieldValue', () => {
  it('treats an empty value as unset for every type', () => {
    expect(cleanFieldValue(def(), '   ')).toBe('');
    expect(cleanFieldValue(def({ type: 'date' }), '')).toBe('');
  });

  it('caps text at 500 characters and rejects HTML', () => {
    expect(cleanFieldValue(def(), ' Payments ')).toBe('Payments');
    expect(cleanFieldValue(def(), 'x'.repeat(500))).toHaveLength(500);
    expect(() => cleanFieldValue(def(), 'x'.repeat(501))).toThrow('500 characters');
    expect(() => cleanFieldValue(def(), '<img src=x onerror=alert(1)>')).toThrow('HTML');
  });

  it('accepts only http and https links for a URL', () => {
    const url = def({ type: 'url' });

    expect(cleanFieldValue(url, 'https://example.com/a')).toBe('https://example.com/a');
    expect(() => cleanFieldValue(url, 'javascript:alert(1)')).toThrow('https://');
    expect(() => cleanFieldValue(url, 'data:text/html,hi')).toThrow('https://');
    expect(() => cleanFieldValue(url, 'not a link')).toThrow('https://');
  });

  it('accepts only a real calendar date', () => {
    const date = def({ type: 'date' });

    expect(cleanFieldValue(date, '2024-02-29')).toBe('2024-02-29');
    expect(() => cleanFieldValue(date, '2023-02-29')).toThrow('valid date');
    expect(() => cleanFieldValue(date, '2024-13-01')).toThrow('valid date');
    expect(() => cleanFieldValue(date, 'tomorrow')).toThrow('valid date');
  });

  it('accepts only a listed option for a select', () => {
    const select = def({ type: 'select', options: ['S', 'M'] });

    expect(cleanFieldValue(select, 'M')).toBe('M');
    expect(() => cleanFieldValue(select, 'XL')).toThrow('listed options');
  });

  it('rejects a value that is not text', () => {
    expect(() => cleanFieldValue(def(), 5)).toThrow(ValidationError);
  });
});

describe('cleanDefinedValues', () => {
  it('validates defined values, drops empty ones and passes unknown keys through', () => {
    const definitions = [def({ id: 'team' }), def({ id: 'when', name: 'When', type: 'date' })];

    expect(cleanDefinedValues({ team: ' Payments ', when: '', gone: 'old' }, definitions)).toEqual({
      team: 'Payments',
      gone: 'old',
    });
  });

  it('names the field in the error without echoing the value', () => {
    const definitions = [def({ id: 'when', name: 'Start', type: 'date' })];

    expect(() => cleanDefinedValues({ when: 'secret-value' }, definitions)).toThrow(
      'Start: Enter a valid date',
    );
    try {
      cleanDefinedValues({ when: 'secret-value' }, definitions);
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-value');
    }
  });
});

import { describe, expect, it } from 'vitest';
import { stripHtml, toDateInputValue, validateForm } from './validateMemberForm';

const NOW = new Date(2025, 5, 10, 12);

describe('validateForm', () => {
  it('accepts a name alone', () => {
    expect(validateForm({ name: 'Priya Sharma' }, { now: NOW })).toEqual({});
  });

  it('requires a name that is not only whitespace or tags', () => {
    expect(validateForm({ name: '   ' }, { now: NOW }).name).toBeDefined();
    expect(validateForm({ name: '<i></i>' }, { now: NOW }).name).toBeDefined();
  });

  it('rejects a name over 200 characters', () => {
    expect(validateForm({ name: 'a'.repeat(201) }, { now: NOW }).name).toBeDefined();
    expect(validateForm({ name: 'a'.repeat(200) }, { now: NOW }).name).toBeUndefined();
  });

  it('treats email as optional but checks its format', () => {
    expect(validateForm({ name: 'A', email: '' }, { now: NOW }).email).toBeUndefined();
    expect(validateForm({ name: 'A', email: 'a@b.co' }, { now: NOW }).email).toBeUndefined();
    for (const email of ['a', 'a@b', 'a b@c.com', '@b.com', 'a@@b.com']) {
      expect(validateForm({ name: 'A', email }, { now: NOW }).email).toBeDefined();
    }
  });

  it('rejects an email over 254 characters', () => {
    const email = `${'a'.repeat(250)}@b.co`;
    expect(validateForm({ name: 'A', email }, { now: NOW }).email).toBeDefined();
  });

  it('allows start dates from exactly one year ago up to five years ahead', () => {
    expect(
      validateForm({ name: 'A', startDate: '2024-06-10' }, { now: NOW }).startDate,
    ).toBeUndefined();
    expect(
      validateForm({ name: 'A', startDate: '2030-06-10' }, { now: NOW }).startDate,
    ).toBeUndefined();
    expect(validateForm({ name: 'A', startDate: '' }, { now: NOW }).startDate).toBeUndefined();
  });

  it('rejects start dates more than a year ago or more than five years ahead', () => {
    expect(
      validateForm({ name: 'A', startDate: '2024-06-09' }, { now: NOW }).startDate,
    ).toBeDefined();
    expect(
      validateForm({ name: 'A', startDate: '2030-06-11' }, { now: NOW }).startDate,
    ).toBeDefined();
  });

  it('does not flag an existing member\u2019s unchanged old start date', () => {
    const values = { name: 'A', startDate: '2019-04-01' };
    expect(validateForm(values, { now: NOW }).startDate).toBeDefined();
    expect(
      validateForm(values, { now: NOW, originalStartDate: '2019-04-01' }).startDate,
    ).toBeUndefined();
  });

  it('rejects dates that do not exist', () => {
    expect(
      validateForm({ name: 'A', startDate: '2025-02-30' }, { now: NOW }).startDate,
    ).toBeDefined();
    expect(validateForm({ name: 'A', startDate: 'soon' }, { now: NOW }).startDate).toBeDefined();
  });
});

describe('stripHtml', () => {
  it('removes tags, including unterminated ones, and trims', () => {
    expect(stripHtml('  <b>Bold</b> name ')).toBe('Bold name');
    expect(stripHtml('a <script src=x')).toBe('a');
    expect(stripHtml('2 < 3')).toBe('2 < 3');
  });
});

describe('toDateInputValue', () => {
  it('formats a local calendar day with zero padding', () => {
    expect(toDateInputValue(new Date(2025, 0, 5))).toBe('2025-01-05');
  });
});

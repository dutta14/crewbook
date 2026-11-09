import { describe, expect, it } from 'vitest';
import { getUrlHostname, normalizeExternalUrl } from './externalUrl';

describe('normalizeExternalUrl', () => {
  it('accepts http and https links and returns the normalised href', () => {
    expect(normalizeExternalUrl('https://Docs.Google.com/document/d/a?tab=t.0#h')).toBe(
      'https://docs.google.com/document/d/a?tab=t.0#h',
    );
    expect(normalizeExternalUrl('  http://wiki.example.com  ')).toBe('http://wiki.example.com/');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hi',
    'vbscript:x',
    'file:///etc/hosts',
    'blob:https://example.com/id',
    'mailto:a@example.com',
    'https://u:p@example.com',
    'https://',
    'not a url',
    '',
    '\u0000https://example.com',
  ])('rejects %j', (value) => {
    expect(normalizeExternalUrl(value)).toBeNull();
  });

  it('rejects values that are not strings', () => {
    expect(normalizeExternalUrl(undefined)).toBeNull();
    expect(normalizeExternalUrl(42)).toBeNull();
  });

  it('rejects anything longer than 2048 characters', () => {
    expect(normalizeExternalUrl(`https://example.com/${'a'.repeat(2020)}`)).not.toBeNull();
    expect(normalizeExternalUrl(`https://example.com/${'a'.repeat(2048)}`)).toBeNull();
  });
});

describe('getUrlHostname', () => {
  it('returns the host without path or query', () => {
    expect(getUrlHostname('https://docs.google.com/document/d/a?token=secret')).toBe(
      'docs.google.com',
    );
  });

  it('returns an empty string for something that is not a safe link', () => {
    expect(getUrlHostname('javascript:alert(1)')).toBe('');
  });
});

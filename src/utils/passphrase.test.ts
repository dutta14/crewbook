import { describe, expect, it } from 'vitest';
import { constantTimeEqual, getPassphraseStrength, validateNewPassphrase } from './passphrase';

describe('constantTimeEqual', () => {
  it('is true for identical strings, including empty ones', () => {
    expect(constantTimeEqual('DELETE', 'DELETE')).toBe(true);
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('is false for a different case, a prefix, or a longer string', () => {
    expect(constantTimeEqual('DELETE', 'delete')).toBe(false);
    expect(constantTimeEqual('DELETE', 'DELET')).toBe(false);
    expect(constantTimeEqual('DELETE', 'DELETE ')).toBe(false);
  });

  it('compares multi-byte characters', () => {
    expect(constantTimeEqual('pässword', 'pässword')).toBe(true);
    expect(constantTimeEqual('pässword', 'passwörd')).toBe(false);
  });
});

describe('validateNewPassphrase', () => {
  it('accepts 8 to 128 characters', () => {
    expect(validateNewPassphrase('a'.repeat(8))).toBeNull();
    expect(validateNewPassphrase('a'.repeat(128))).toBeNull();
  });

  it('rejects one character under and over the limits', () => {
    expect(validateNewPassphrase('a'.repeat(7))).toBe('Use at least 8 characters');
    expect(validateNewPassphrase('a'.repeat(129))).toBe('Use 128 characters or fewer');
  });

  it('rejects a null byte anywhere in the passphrase', () => {
    expect(validateNewPassphrase('long enough\0passphrase')).toMatch(/null characters/);
  });
});

describe('getPassphraseStrength', () => {
  it('grades by length', () => {
    expect(getPassphraseStrength('short pass')).toBe('Weak');
    expect(getPassphraseStrength('twelve chars!')).toBe('Fair');
    expect(getPassphraseStrength('correct horse battery staple')).toBe('Strong');
  });
});

export const MIN_PASSPHRASE_LENGTH = 8;
export const MAX_PASSPHRASE_LENGTH = 128;

/**
 * Compares two strings without stopping at the first difference, so how long the comparison takes
 * does not reveal how much of a typed secret was right.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

/** A message for a new passphrase that is not acceptable, or null when it is fine. */
export function validateNewPassphrase(passphrase: string): string | null {
  if (passphrase.includes('\0')) return 'Remove any null characters from your passphrase';
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `Use at least ${MIN_PASSPHRASE_LENGTH} characters`;
  }
  if (passphrase.length > MAX_PASSPHRASE_LENGTH) {
    return `Use ${MAX_PASSPHRASE_LENGTH} characters or fewer`;
  }
  return null;
}

export type PassphraseStrength = 'Weak' | 'Fair' | 'Strong';

/** Length is what protects a passphrase, so that is all this judges. Not a guarantee of safety. */
export function getPassphraseStrength(passphrase: string): PassphraseStrength {
  if (passphrase.length >= 16) return 'Strong';
  if (passphrase.length >= 12) return 'Fair';
  return 'Weak';
}

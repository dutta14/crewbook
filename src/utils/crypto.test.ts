import { beforeAll, describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  decryptString,
  deriveKey,
  encryptString,
  generateSalt,
  isEncryptedEnvelope,
  PBKDF2_ITERATIONS,
  type EncryptedEnvelope,
} from './crypto';

let salt: Uint8Array<ArrayBuffer>;
let key: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  salt = generateSalt();
  [key, otherKey] = await Promise.all([
    deriveKey('correct horse', salt),
    deriveKey('wrong horse', salt),
  ]);
});

describe('encrypt and decrypt', () => {
  it('returns the original data after an encrypt then decrypt round trip', async () => {
    const plaintext = JSON.stringify({ members: [{ name: 'Alex Chen' }] });

    const envelope = await encryptString(plaintext, key);

    expect(await decryptString(envelope, key)).toBe(plaintext);
  });

  it('throws when decrypting with a key from a different passphrase', async () => {
    const envelope = await encryptString('secret', key);

    await expect(decryptString(envelope, otherKey)).rejects.toThrow();
  });

  it('throws when the ciphertext has been tampered with', async () => {
    const envelope = await encryptString('secret', key);
    const bytes = base64ToBytes(envelope.ct);
    bytes[0] ^= 0xff;

    await expect(decryptString({ ...envelope, ct: bytesToBase64(bytes) }, key)).rejects.toThrow();
  });

  it('round-trips special characters and unicode', async () => {
    const plaintext = JSON.stringify({
      note: 'Zoë said "ship it" \\ 🚀 日本語 <script>alert(1)</script>\n\t',
    });

    const envelope = await encryptString(plaintext, key);

    expect(await decryptString(envelope, key)).toBe(plaintext);
  });

  it('round-trips a large nested JSON object', async () => {
    const plaintext = JSON.stringify({
      members: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        notes: Array.from({ length: 200 }, (_, n) => ({ n, text: `1:1 note ${i}-${n}`.repeat(5) })),
      })),
    });

    const envelope = await encryptString(plaintext, key);

    expect(await decryptString(envelope, key)).toBe(plaintext);
  });

  it('uses a fresh 12-byte IV for every encryption', async () => {
    const [first, second] = await Promise.all([
      encryptString('same', key),
      encryptString('same', key),
    ]);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ct).not.toBe(second.ct);
    expect(base64ToBytes(first.iv)).toHaveLength(12);
  });

  it('does not leave the plaintext readable in the envelope', async () => {
    const envelope = await encryptString('very-recognisable-plaintext', key);

    expect(JSON.stringify(envelope)).not.toContain('very-recognisable-plaintext');
    expect(atob(envelope.ct)).not.toContain('very-recognisable-plaintext');
  });

  it('records the PBKDF2 iteration count in the envelope', async () => {
    expect((await encryptString('x', key)).iterations).toBe(PBKDF2_ITERATIONS);
  });
});

describe('deriveKey', () => {
  it('derives a non-extractable key', async () => {
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('refuses an iteration count below 310,000', async () => {
    await expect(deriveKey('x', salt, PBKDF2_ITERATIONS - 1)).rejects.toThrow(RangeError);
  });

  it('derives different keys for different salts', async () => {
    const otherSaltKey = await deriveKey('correct horse', generateSalt());
    const envelope = await encryptString('secret', key);

    await expect(decryptString(envelope, otherSaltKey)).rejects.toThrow();
  });
});

describe('generateSalt', () => {
  it('returns 16 random bytes', () => {
    const first = generateSalt();

    expect(first).toHaveLength(16);
    expect(bytesToBase64(first)).not.toBe(bytesToBase64(generateSalt()));
  });
});

describe('isEncryptedEnvelope', () => {
  const valid: EncryptedEnvelope = { v: 1, iv: 'AAAA', ct: 'BBBB', iterations: PBKDF2_ITERATIONS };

  it('accepts a well-formed envelope', () => {
    expect(isEncryptedEnvelope(valid)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'envelope'],
    ['an unknown version', { ...valid, v: 2 }],
    ['an empty iv', { ...valid, iv: '' }],
    ['an iv that is not base64', { ...valid, iv: '***' }],
    ['a missing ciphertext', { v: 1, iv: 'AAAA', iterations: PBKDF2_ITERATIONS }],
    ['iterations below the minimum', { ...valid, iterations: PBKDF2_ITERATIONS - 1 }],
    ['iterations above the sanity cap', { ...valid, iterations: 1e12 }],
    ['non-integer iterations', { ...valid, iterations: PBKDF2_ITERATIONS + 0.5 }],
    ['string iterations', { ...valid, iterations: String(PBKDF2_ITERATIONS) }],
  ])('rejects %s', (_label, value) => {
    expect(isEncryptedEnvelope(value)).toBe(false);
  });
});

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes including large buffers', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);

    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

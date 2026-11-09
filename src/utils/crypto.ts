export const PBKDF2_ITERATIONS = 310_000;
// Guards against a tampered envelope asking the browser to run an unbounded derivation.
const MAX_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedEnvelope {
  v: 1;
  iv: string;
  ct: string;
  iterations: number;
}

export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (iterations < PBKDF2_ITERATIONS) {
    throw new RangeError(`PBKDF2 iterations must be at least ${PBKDF2_ITERATIONS}`);
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export const SHARE_SIGNING_CONTEXT = 'share-signing';

/**
 * An HMAC-SHA256 key for signing share links. The passphrase goes through the same PBKDF2 as the
 * storage keys, then HKDF with a fixed context, so the signing key is unrelated to the AES keys.
 */
export async function deriveSigningKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (iterations < PBKDF2_ITERATIONS) {
    throw new RangeError(`PBKDF2 iterations must be at least ${PBKDF2_ITERATIONS}`);
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode(SHARE_SIGNING_CONTEXT),
    },
    hkdfKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );
}

export async function encryptString(
  plaintext: string,
  key: CryptoKey,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<EncryptedEnvelope> {
  // AES-GCM is catastrophically weak if an IV repeats, so every call draws a fresh one.
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    v: 1,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
    iterations,
  };
}

export async function decryptString(envelope: EncryptedEnvelope, key: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ct),
  );
  return new TextDecoder().decode(plaintext);
}

function isBase64(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    atob(value);
    return true;
  } catch {
    return false;
  }
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === 1 &&
    isBase64(candidate.iv) &&
    isBase64(candidate.ct) &&
    typeof candidate.iterations === 'number' &&
    Number.isInteger(candidate.iterations) &&
    candidate.iterations >= PBKDF2_ITERATIONS &&
    candidate.iterations <= MAX_ITERATIONS
  );
}

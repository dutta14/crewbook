// A stand-in for the 310,000-iteration PBKDF2 derivation so unit tests do not pay ~300ms per
// derivation. Only the key derivation is replaced; real AES-GCM still runs.
export async function fastDeriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const input = new Uint8Array([...new TextEncoder().encode(passphrase), ...salt]);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

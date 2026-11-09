import type { SharedViewPayload } from '../types/sharing';
import { SHARE_LIMITS, validateSharePayload } from './validateSharePayload';

export class ShareUnsupportedError extends Error {
  constructor() {
    super('This browser cannot create share links');
    this.name = 'ShareUnsupportedError';
  }
}

export class ShareTooLargeError extends Error {
  constructor() {
    super('There is too much to fit in one link');
    this.name = 'ShareTooLargeError';
  }
}

const MAX_BYTES = SHARE_LIMITS.maxPayloadBytes;
const SIGNATURE_LENGTH = 43; // 32 bytes as unpadded base64url
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const TOKEN_IN_URL = /\/shared\/([^/?#\s]+)/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL.test(text) || text.length % 4 === 1) return null;
  const padded = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

const ignore = () => undefined;

/** Reads a stream to the end, giving up as soon as it passes `limit` bytes. */
async function readLimited(
  stream: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel().catch(ignore);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

async function pipeThrough(
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
  limit: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const writer = transform.writable.getWriter();
  writer.write(bytes).catch(ignore);
  writer.close().catch(ignore);
  return readLimited(transform.readable, limit);
}

function requireStreams(): void {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') {
    throw new ShareUnsupportedError();
  }
}

async function sign(data: Uint8Array<ArrayBuffer>, key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

/**
 * Packs a payload into a token: compressed JSON, then a signature over those exact bytes. The
 * link carries the data itself, since there is no server to hold it.
 */
export async function createShareToken(
  payload: SharedViewPayload,
  key: CryptoKey,
): Promise<string> {
  requireStreams();
  const json = new TextEncoder().encode(JSON.stringify(payload));
  if (json.length > MAX_BYTES) throw new ShareTooLargeError();
  const compressed = await pipeThrough(json, new CompressionStream('deflate'), MAX_BYTES);
  if (compressed === null) throw new ShareTooLargeError();
  return `${toBase64Url(compressed)}.${toBase64Url(await sign(compressed, key))}`;
}

/** A full link to the shared view, using the page's own address as the base. */
export async function createShareUrl(
  payload: SharedViewPayload,
  key: CryptoKey,
  base: string = `${window.location.origin}${window.location.pathname}`,
): Promise<string> {
  return `${base}#/shared/${await createShareToken(payload, key)}`;
}

/** Accepts a bare token, or anything containing `/shared/<token>`, such as a whole link. */
export function extractShareToken(input: string): string | null {
  const text = input.trim();
  const match = TOKEN_IN_URL.exec(text);
  const token = match ? match[1] : text;
  return token !== '' && !/\s/.test(token) ? token : null;
}

/**
 * Turns a token back into a payload, or null for anything wrong with it: bad characters, an
 * oversized body, data that is not deflate, a failed signature, or a payload outside the allowed
 * shape. The signature is checked before the body is decompressed or parsed. Pass `key` only where
 * it is known; a recipient has no key, so for them the checks that remain are shape and size.
 */
export async function readShareToken(
  input: string,
  key: CryptoKey | null,
): Promise<SharedViewPayload | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  const token = extractShareToken(input);
  const parts = token?.split('.') ?? [];
  if (parts.length !== 2 || parts[1].length !== SIGNATURE_LENGTH) return null;
  const compressed = fromBase64Url(parts[0]);
  const signature = fromBase64Url(parts[1]);
  if (!compressed || !signature || compressed.length === 0 || compressed.length > MAX_BYTES) {
    return null;
  }
  if (key !== null && !(await crypto.subtle.verify('HMAC', key, signature, compressed))) {
    return null;
  }
  const json = await pipeThrough(compressed, new DecompressionStream('deflate'), MAX_BYTES);
  if (json === null) return null;
  try {
    return validateSharePayload(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json)));
  } catch {
    return null;
  }
}

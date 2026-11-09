import { describe, expect, it } from 'vitest';
import type { SharedViewPayload } from '../types/sharing';
import { makePayload } from '../test-utils/sharePayload';
import {
  ShareTooLargeError,
  createShareToken,
  createShareUrl,
  extractShareToken,
  readShareToken,
} from './shareUrl';

const newKey = () =>
  crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

const flip = (token: string, index: number) => {
  const swap = token[index] === 'A' ? 'B' : 'A';
  return token.slice(0, index) + swap + token.slice(index + 1);
};

describe('share tokens', () => {
  it('round-trips a payload with and without the key', async () => {
    const key = await newKey();
    const token = await createShareToken(makePayload(), key);
    expect(await readShareToken(token, key)).toEqual(makePayload());
    expect(await readShareToken(token, null)).toEqual(makePayload());
  });

  it('keeps the payload text out of the clear in the link', async () => {
    const token = await createShareToken(makePayload(), await newKey());
    expect(token).not.toContain('launch');
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  });

  it('builds a link that points at the shared route and can be read back whole', async () => {
    const key = await newKey();
    const url = await createShareUrl(makePayload(), key, 'http://localhost/app/');
    expect(url.startsWith('http://localhost/app/#/shared/')).toBe(true);
    expect(await readShareToken(url, key)).toEqual(makePayload());
  });

  it('rejects a token signed with a different key', async () => {
    const token = await createShareToken(makePayload(), await newKey());
    expect(await readShareToken(token, await newKey())).toBeNull();
  });

  it('rejects a token whose body was altered', async () => {
    const key = await newKey();
    const token = await createShareToken(makePayload(), key);
    expect(await readShareToken(flip(token, 4), key)).toBeNull();
  });

  it('rejects a token whose signature was altered', async () => {
    const key = await newKey();
    const token = await createShareToken(makePayload(), key);
    expect(await readShareToken(flip(token, token.length - 3), key)).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['no signature', 'abcd'],
    ['three parts', 'a.b.c'],
    ['bad characters', 'ab+/=.cd'],
    ['short signature', 'AAAA.AAAA'],
    ['not deflate data', `AAAAAAAA.${'A'.repeat(43)}`],
    ['markup', `<img src=x onerror=alert(1)>.${'A'.repeat(43)}`],
  ])('returns null for %s', async (_name, input) => {
    expect(await readShareToken(input, null)).toBeNull();
  });

  it('refuses a payload that does not match the allowed shape, even when signed', async () => {
    const key = await newKey();
    const extra = { ...makePayload(), secret: 'nope' } as unknown as SharedViewPayload;
    const token = await createShareToken(extra, key);
    expect(await readShareToken(token, key)).toBeNull();
  });

  it('refuses to create a link for more than the size limit', async () => {
    const big = makePayload({
      sharedNotes: Array.from({ length: 100 }, (_, i) => ({
        id: `n${i}`,
        text: `${i} ${Array.from({ length: 700 }, (_, j) => ((i * 31 + j * 17) % 997).toString(36)).join(' ')}`,
        createdAt: '2026-01-07T10:00:00Z',
      })),
    });
    await expect(createShareToken(big, await newKey())).rejects.toBeInstanceOf(ShareTooLargeError);
  });

  it('refuses to inflate a small token into an oversized body', async () => {
    const compressor = new CompressionStream('deflate');
    const writer = compressor.writable.getWriter();
    void writer.write(new Uint8Array(5_000_000));
    void writer.close();
    const reader = compressor.readable.getReader();
    const parts: number[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(...value);
    }
    const bytes = Uint8Array.from(parts);
    const bomb = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(bytes.length).toBeLessThan(65_536);
    expect(await readShareToken(`${bomb}.${'A'.repeat(43)}`, null)).toBeNull();
  });
});

describe('extractShareToken', () => {
  it('takes the token from a full link, a route or a bare token', () => {
    expect(extractShareToken('http://x/#/shared/abc.def')).toBe('abc.def');
    expect(extractShareToken('#/shared/abc.def?x=1')).toBe('abc.def');
    expect(extractShareToken(' abc.def ')).toBe('abc.def');
  });

  it('returns null when there is nothing to take', () => {
    expect(extractShareToken('   ')).toBeNull();
    expect(extractShareToken('a b')).toBeNull();
  });
});

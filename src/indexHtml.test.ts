import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const doc = new DOMParser().parseFromString(
  readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'),
  'text/html',
);

describe('index.html', () => {
  it('sets the document title to Crewbook', () => {
    expect(doc.title).toBe('Crewbook');
  });

  it('includes a description meta tag', () => {
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(
      /people management/i,
    );
  });

  it('includes a responsive viewport meta tag', () => {
    expect(doc.querySelector('meta[name="viewport"]')?.getAttribute('content')).toContain(
      'width=device-width',
    );
  });

  it('blocks all network requests, framing and plugins through the CSP', () => {
    const csp =
      doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ??
      '';

    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self'");
  });
});

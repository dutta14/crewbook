export const URL_MAX_LENGTH = 2048;

// Control characters are rejected rather than stripped: the URL parser silently removes tabs and
// line breaks, which would let a link read differently from what was checked.
const hasControlCharacter = (value: string) =>
  Array.from(value).some((char) => char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f);

/**
 * The normalised href for a link that is safe to open in another tab, or null. Only http: and
 * https: pass; javascript:, data:, vbscript:, file: and anything else do not. Addresses with an
 * embedded username or password are refused because they are a common way to disguise the host.
 * Never throws and never echoes the value, which may carry a token.
 */
export function normalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > URL_MAX_LENGTH || hasControlCharacter(trimmed)) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') return null;
  return parsed.href.length <= URL_MAX_LENGTH ? parsed.href : null;
}

/** The host of a link, so the destination can be checked before clicking. Empty if not a link. */
export function getUrlHostname(value: string): string {
  const href = normalizeExternalUrl(value);
  return href ? new URL(href).hostname : '';
}

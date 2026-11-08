const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** A mailto: link for a well-formed address, otherwise null so the caller renders plain text. */
export function toMailtoHref(email: string): string | null {
  const trimmed = email.trim();
  if (!EMAIL_PATTERN.test(trimmed) || /^javascript:/i.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}

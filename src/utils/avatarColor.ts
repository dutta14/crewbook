// Design-system avatar palette; every colour passes AA contrast (4.5:1) against white text.
export const AVATAR_PALETTE: readonly string[] = [
  '#0f766e',
  '#b45309',
  '#7c3aed',
  '#0369a1',
  '#be123c',
  '#6d28d9',
  '#c2410c',
  '#7e22ce',
  '#0e7490',
  '#9f1239',
];

/** Deterministic colour: sum of the name's char codes modulo the palette length. */
export function getAvatarColor(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

/** First and last initial, uppercase. One initial for a single name, empty for a blank one. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = Array.from(words[0])[0];
  if (words.length === 1) return first.toUpperCase();
  return (first + Array.from(words[words.length - 1])[0]).toUpperCase();
}

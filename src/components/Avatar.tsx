import '../styles/avatar.css';

export type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  /** Hide the avatar from assistive technology when the name is already rendered beside it. */
  decorative?: boolean;
}

// Design-system palette; every colour passes AA contrast against white text.
const PALETTE = [
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

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0];
  if (words.length === 1) return first.toUpperCase();
  return (first + Array.from(words[words.length - 1])[0]).toUpperCase();
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({ name, size = 'md', decorative = false }: AvatarProps) {
  const label = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name };
  return (
    <span
      className={`avatar avatar--${size}`}
      style={{ backgroundColor: getAvatarColor(name) }}
      {...label}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
    </span>
  );
}

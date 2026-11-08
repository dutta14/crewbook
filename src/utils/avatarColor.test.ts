import { describe, expect, it } from 'vitest';
import { AVATAR_PALETTE, getAvatarColor, getInitials } from './avatarColor';

describe('getInitials', () => {
  it.each([
    ['Anindya Dutta', 'AD'],
    ['alex  chen', 'AC'],
    ['John Michael Doe', 'JD'],
    ['Priya', 'P'],
    ['  Priya  ', 'P'],
    ['Émile Zola', 'ÉZ'],
    ['', ''],
    ['   ', ''],
  ])('turns "%s" into "%s"', (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });
});

describe('getAvatarColor', () => {
  it('uses the char-code sum modulo the palette length', () => {
    // "AB" = 65 + 66 = 131; 131 % 10 = 1
    expect(getAvatarColor('AB')).toBe(AVATAR_PALETTE[1]);
  });

  it('falls back to the first palette colour for an empty name', () => {
    expect(getAvatarColor('')).toBe(AVATAR_PALETTE[0]);
  });

  it('always returns a palette colour', () => {
    for (const name of ['Anindya Dutta', 'Priya', '😀 Smile', 'x'.repeat(500)]) {
      expect(AVATAR_PALETTE).toContain(getAvatarColor(name));
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { SharedActionItem } from '../types/sharing';
import { describeDoneCount, getOwnerLabel, splitByStatus } from './sharedActionItems';

describe('getOwnerLabel', () => {
  it('says "You" for the reader’s own items and names the other person otherwise', () => {
    expect(getOwnerLabel('engineer', false, 'Morgan Lee')).toBe('You');
    expect(getOwnerLabel('manager', false, 'Morgan Lee')).toBe('Morgan Lee');
    expect(getOwnerLabel('manager', true, 'Morgan Lee')).toBe('You');
    expect(getOwnerLabel('engineer', true, 'Morgan Lee')).toBe('Engineer');
  });
});

describe('splitByStatus', () => {
  it('keeps the order within each group', () => {
    const items: SharedActionItem[] = [
      { id: 'a1', title: 'One', status: 'done', owner: 'manager' },
      { id: 'a2', title: 'Two', status: 'open', owner: 'manager' },
      { id: 'a3', title: 'Three', status: 'done', owner: 'engineer' },
      { id: 'a4', title: 'Four', status: 'open', owner: 'engineer' },
    ];

    const { open, done } = splitByStatus(items);

    expect(open.map((item) => item.id)).toEqual(['a2', 'a4']);
    expect(done.map((item) => item.id)).toEqual(['a1', 'a3']);
  });
});

describe('describeDoneCount', () => {
  it('uses the singular for one and the plural otherwise, with no titles', () => {
    expect(describeDoneCount(0)).toBe('0 items done');
    expect(describeDoneCount(1)).toBe('1 item done');
    expect(describeDoneCount(3)).toBe('3 items done');
  });
});

import { describe, expect, it } from 'vitest';
import { getArrowTarget, getDropIndex, reorderList } from './dragReorder';

describe('reorderList', () => {
  it('moves an item without changing the original list', () => {
    const list = ['a', 'b', 'c'];

    expect(reorderList(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorderList(list, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('returns an unchanged copy for a move that is out of range or goes nowhere', () => {
    expect(reorderList(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    expect(reorderList(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
    expect(reorderList(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('getArrowTarget', () => {
  it('moves one step with the arrow keys and stops at the ends', () => {
    expect(getArrowTarget('ArrowUp', 1, 3)).toBe(0);
    expect(getArrowTarget('ArrowDown', 1, 3)).toBe(2);
    expect(getArrowTarget('ArrowUp', 0, 3)).toBeNull();
    expect(getArrowTarget('ArrowDown', 2, 3)).toBeNull();
    expect(getArrowTarget('Enter', 1, 3)).toBeNull();
  });
});

describe('getDropIndex', () => {
  it('counts the rows whose midpoint the pointer has passed', () => {
    const midpoints = [10, 30, 50];

    expect(getDropIndex(midpoints, 0)).toBe(0);
    expect(getDropIndex(midpoints, 20)).toBe(1);
    expect(getDropIndex(midpoints, 35)).toBe(2);
    expect(getDropIndex(midpoints, 999)).toBe(2);
    expect(getDropIndex([], 5)).toBe(0);
  });
});

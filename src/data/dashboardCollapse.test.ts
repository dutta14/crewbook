import { describe, expect, it, vi } from 'vitest';
import { readCollapseState, setSectionCollapsed } from './dashboardCollapse';

const KEY = 'dashboard-collapse-state';

describe('dashboardCollapse', () => {
  it('reads nothing as every section expanded', () => {
    expect(readCollapseState()).toEqual({});
  });

  it('merges each change into what was saved', () => {
    setSectionCollapsed('reminders', true);
    setSectionCollapsed('on-leave', true);
    setSectionCollapsed('reminders', false);

    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '')).toEqual({
      reminders: false,
      'on-leave': true,
    });
  });

  it.each(['{nope', '[true]', '{"reminders":"yes"}', 'null'])(
    'treats %s as expanded and repairs it',
    (damaged) => {
      window.localStorage.setItem(KEY, damaged);

      expect(readCollapseState()).toEqual({});
      expect(window.localStorage.getItem(KEY)).toBe('{}');
    },
  );

  it('carries on when storage refuses to read or write', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readCollapseState()).toEqual({});
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });

    expect(() => setSectionCollapsed('reminders', true)).not.toThrow();
    spy.mockRestore();
    set.mockRestore();
  });
});

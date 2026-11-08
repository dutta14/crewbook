import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPrepDismissal, dismissPrep, isPrepDismissed } from './prepDismissal';

describe('prepDismissal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('stores only a bare flag when dismissed and clears it again', () => {
    expect(isPrepDismissed()).toBe(false);

    dismissPrep();

    expect(isPrepDismissed()).toBe(true);
    expect(window.sessionStorage.getItem('crewbook:prep-dismissed')).toBe('true');
    expect(window.sessionStorage.length).toBe(1);

    clearPrepDismissal();

    expect(isPrepDismissed()).toBe(false);
  });

  it('treats unavailable storage as not dismissed without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => dismissPrep()).not.toThrow();
    expect(() => clearPrepDismissal()).not.toThrow();
    expect(isPrepDismissed()).toBe(false);
  });
});

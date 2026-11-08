import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIPBOARD_CLEAR_DELAY_MS, copyWithAutoClear } from './clipboard';

describe('copyWithAutoClear', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  const readText = vi.fn<() => Promise<string>>();

  beforeEach(() => {
    vi.useFakeTimers();
    writeText.mockReset().mockResolvedValue(undefined);
    readText.mockReset();
    vi.stubGlobal('navigator', { clipboard: { writeText, readText } });
  });

  afterEach(() => vi.useRealTimers());

  it('copies now and clears the clipboard after a minute', async () => {
    readText.mockResolvedValue('secret');

    await copyWithAutoClear('secret');
    expect(writeText).toHaveBeenCalledExactlyOnceWith('secret');

    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_DELAY_MS);
    expect(writeText).toHaveBeenLastCalledWith('');
  });

  it('leaves the clipboard alone when something else has been copied since', async () => {
    readText.mockResolvedValue('something else');

    await copyWithAutoClear('secret');
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_DELAY_MS);

    expect(writeText).toHaveBeenCalledOnce();
  });

  it('still clears when the browser will not let it read the clipboard', async () => {
    readText.mockRejectedValue(new Error('denied'));

    await copyWithAutoClear('secret');
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_DELAY_MS);

    expect(writeText).toHaveBeenLastCalledWith('');
  });

  it('restarts the countdown on a later copy', async () => {
    readText.mockResolvedValueOnce('second');

    await copyWithAutoClear('first');
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_DELAY_MS - 1000);
    await copyWithAutoClear('second');
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_DELAY_MS - 1000);
    expect(writeText).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(writeText).toHaveBeenLastCalledWith('');
  });

  it('survives a clipboard that fails while clearing', async () => {
    readText.mockResolvedValue('secret');
    writeText.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('blurred'));

    await copyWithAutoClear('secret');
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_DELAY_MS);

    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('rejects when the copy fails', async () => {
    writeText.mockRejectedValue(new Error('denied'));

    await expect(copyWithAutoClear('secret')).rejects.toThrow('denied');
  });
});

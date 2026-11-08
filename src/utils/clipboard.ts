export const CLIPBOARD_CLEAR_DELAY_MS = 60_000;

let clearTimer: ReturnType<typeof setTimeout> | undefined;

/** Best effort: the browser may refuse once the tab has lost focus. */
async function clearIfUntouched(copied: string) {
  try {
    // If someone has copied something else since, leave it alone. A browser that will not let us
    // read the clipboard still lets us clear it.
    const current = await navigator.clipboard.readText().catch(() => copied);
    if (current === copied) await navigator.clipboard.writeText('');
  } catch {
    // Nothing more to do.
  }
}

/**
 * Copies sensitive text and empties the clipboard a minute later. Rejects when the copy fails so
 * the caller can say so. A later copy restarts the countdown.
 */
export async function copyWithAutoClear(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  if (clearTimer !== undefined) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    clearTimer = undefined;
    void clearIfUntouched(text);
  }, CLIPBOARD_CLEAR_DELAY_MS);
}

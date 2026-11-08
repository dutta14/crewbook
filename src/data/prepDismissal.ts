// A single flag with no member id or any other content, so nothing identifying is left behind.
const KEY = 'crewbook:prep-dismissed';

export function isPrepDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissPrep(): void {
  try {
    window.sessionStorage.setItem(KEY, 'true');
  } catch {
    // Dismissing still hides the card for now; it just comes back next time.
  }
}

export function clearPrepDismissal(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing was stored.
  }
}

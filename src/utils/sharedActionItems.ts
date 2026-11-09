import type { SharedActionItem, SharePerson } from '../types/sharing';

export const SESSION_ONLY_NOTE = 'Changes you make here are saved for this session only.';

/**
 * Who the owner is from the reader's side. The shared page is written for the engineer, so
 * `currentUserIsManager` is false there; the viewer is never guessed from the browser.
 */
export function getOwnerLabel(
  owner: SharePerson,
  currentUserIsManager: boolean,
  managerName: string,
): string {
  const viewer: SharePerson = currentUserIsManager ? 'manager' : 'engineer';
  if (owner === viewer) return 'You';
  return owner === 'manager' ? managerName : 'Engineer';
}

export function splitByStatus(items: readonly SharedActionItem[]) {
  return {
    open: items.filter((item) => item.status === 'open'),
    done: items.filter((item) => item.status === 'done'),
  };
}

/** Only a count, never a title: this text is read aloud, possibly on a shared screen. */
export function describeDoneCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'} done`;
}

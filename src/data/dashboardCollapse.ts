// Only section ids and booleans: no names, counts or content, so nothing identifying is left behind.
const KEY = 'dashboard-collapse-state';

export type CollapseState = Record<string, boolean>;

function isCollapseState(value: unknown): value is CollapseState {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((flag) => typeof flag === 'boolean')
  );
}

function write(state: CollapseState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // The section still collapses for now; it just opens again next time.
  }
}

/** Damaged or missing data means every section is expanded, and damaged data is overwritten. */
export function readCollapseState(): CollapseState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return {};
  }
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isCollapseState(parsed)) return parsed;
  } catch {
    // Falls through to the repair below.
  }
  write({});
  return {};
}

export function setSectionCollapsed(id: string, isCollapsed: boolean): void {
  write({ ...readCollapseState(), [id]: isCollapsed });
}

/** Forgets which dashboard sections were collapsed, as part of Clear All Data. */
export function clearCollapseState(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored.
  }
}

import { GROWTH_CHANGE_TYPE_LABELS } from '../data/growthStore';
import type { GrowthEntry } from '../types/growth';
import { formatShortDate } from './decisionFormat';

/**
 * The level or role the person holds now: the `to` of their latest entry. A team transfer is
 * skipped because its `to` names a team, and so is an entry with nothing in `to`.
 * `entries` must be newest first.
 */
export function deriveCurrentLevel(entries: GrowthEntry[]): string | null {
  const latest = entries.find((entry) => entry.changeType !== 'team_transfer' && entry.to !== '');
  return latest ? latest.to : null;
}

/** "L4 → L5", "→ L5" when there is no earlier value, or null when neither side is filled in. */
export function describeChange(
  entry: Pick<GrowthEntry, 'from' | 'to'>,
  arrow = '→',
): string | null {
  if (!entry.from && !entry.to) return null;
  if (!entry.from) return entry.to;
  if (!entry.to) return `${entry.from} ${arrow}`;
  return `${entry.from} ${arrow} ${entry.to}`;
}

/** Plain text for a promo packet, oldest entry first. `entries` must be newest first. */
export function formatGrowthSummary(
  name: string,
  currentLevel: string | null,
  entries: GrowthEntry[],
): string {
  const lines = [`Growth history: ${name}`];
  if (currentLevel) lines.push(`Current level/role: ${currentLevel}`);
  for (const entry of [...entries].reverse()) {
    const change = describeChange(entry, '->');
    const heading = `${formatShortDate(entry.date) ?? entry.date} - ${GROWTH_CHANGE_TYPE_LABELS[entry.changeType]}`;
    lines.push('', change ? `${heading}: ${change}` : heading);
    if (entry.notes) lines.push(`Notes: ${entry.notes}`);
  }
  return lines.join('\n');
}

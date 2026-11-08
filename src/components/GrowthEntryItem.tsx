import { GROWTH_CHANGE_TYPE_LABELS } from '../data/growthStore';
import type { GrowthEntry } from '../types/growth';
import { formatLongDate, formatShortDate } from '../utils/decisionFormat';
import { describeChange } from '../utils/growthFormat';
import '../styles/button.css';
import { GrowthChangeBadge } from './GrowthChangeBadge';
import { PencilIcon } from './icons';
import '../styles/growth.css';

interface GrowthEntryItemProps {
  entry: GrowthEntry;
  onEdit: (entry: GrowthEntry) => void;
}

export function GrowthEntryItem({ entry, onEdit }: GrowthEntryItemProps) {
  const change = describeChange(entry);
  const label = GROWTH_CHANGE_TYPE_LABELS[entry.changeType].toLowerCase();
  return (
    <li className="growth-entry">
      <span className="growth-entry__line" aria-hidden="true" />
      <span className="growth-entry__node" aria-hidden="true" />
      <div className="growth-entry__card">
        <div className="growth-entry__top">
          <div className="growth-entry__meta">
            <time className="growth-entry__date" dateTime={entry.date}>
              {formatShortDate(entry.date) ?? entry.date}
            </time>
            <GrowthChangeBadge changeType={entry.changeType} />
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Edit ${label} entry from ${formatLongDate(entry.date) ?? entry.date}`}
            onClick={() => onEdit(entry)}
          >
            <PencilIcon size={16} />
          </button>
        </div>
        {change ? <p className="growth-entry__change">{change}</p> : null}
        {entry.notes ? <p className="growth-entry__notes">{entry.notes}</p> : null}
      </div>
    </li>
  );
}

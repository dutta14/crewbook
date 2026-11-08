import { GROWTH_CHANGE_TYPE_LABELS } from '../data/growthStore';
import type { GrowthChangeType } from '../types/growth';
import '../styles/growth.css';

/** The type is always spelled out, so colour is never the only thing that tells them apart. */
export function GrowthChangeBadge({ changeType }: { changeType: GrowthChangeType }) {
  return (
    <span className="growth-badge" data-change-type={changeType}>
      {GROWTH_CHANGE_TYPE_LABELS[changeType]}
    </span>
  );
}

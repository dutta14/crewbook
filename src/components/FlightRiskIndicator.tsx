import type { FlightRiskLevel } from '../types/flightRisk';
import { FLIGHT_RISK_LABELS } from '../data/privateStore';
import '../styles/flight-risk.css';

interface FlightRiskIndicatorProps {
  /** 'none' renders nothing. */
  level: FlightRiskLevel;
  /** Diameter of the dot in px. */
  size?: number;
  /** Shows the level as text while the manager hovers the avatar; never left in the DOM otherwise. */
  isLabelVisible?: boolean;
}

// Class names are deliberately non-semantic and the level is in no attribute, so DevTools shows
// nothing that reads as an assessment. The only text is for screen readers and the hover label.
const DOT_CLASS: Record<Exclude<FlightRiskLevel, 'none'>, string> = {
  low: 'dot-g',
  medium: 'dot-a',
  high: 'dot-r',
};

/**
 * A small dot for a roster avatar. Roster-only: never render it inside a shared or exported view,
 * whose text would then carry the words "flight risk".
 */
export function FlightRiskIndicator({
  level,
  size = 8,
  isLabelVisible = false,
}: FlightRiskIndicatorProps) {
  if (level === 'none') return null;
  return (
    <span className="avatar-dot">
      <span
        className={`avatar-dot__mark ${DOT_CLASS[level]}`}
        style={{ width: size, height: size }}
      />
      <span className="sr-only">Flight risk: {FLIGHT_RISK_LABELS[level]}</span>
      {isLabelVisible ? (
        <span className="avatar-dot__tip" aria-hidden="true">
          {FLIGHT_RISK_LABELS[level]}
        </span>
      ) : null}
    </span>
  );
}

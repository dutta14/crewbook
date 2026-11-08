import { useId } from 'react';
import { FLIGHT_RISK_LABELS, FLIGHT_RISK_LEVELS } from '../data/privateStore';
import type { FlightRiskLevel } from '../types/flightRisk';
import '../styles/flight-risk.css';

interface FlightRiskSelectorProps {
  value: FlightRiskLevel;
  onChange: (level: FlightRiskLevel) => void;
}

export function FlightRiskSelector({ value, onChange }: FlightRiskSelectorProps) {
  const groupName = useId();

  return (
    <fieldset className="risk-selector">
      <legend className="risk-selector__legend">Flight risk level</legend>
      <div className="risk-selector__options">
        {FLIGHT_RISK_LEVELS.map((level) => (
          <label key={level} className="risk-pill">
            <input
              type="radio"
              className="risk-pill__input"
              name={groupName}
              value={level}
              checked={value === level}
              onChange={() => onChange(level)}
            />
            <span className={`risk-pill__text risk-pill__text--${level}`}>
              {FLIGHT_RISK_LABELS[level]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

import { formatTenureSpoken } from '../utils/tenure';
import '../styles/tenure.css';

interface TenureStatProps {
  months: number;
  /** e.g. "2y 4m" */
  label: string;
}

export function TenureStat({ months, label }: TenureStatProps) {
  return (
    <div
      className="tenure-stat"
      role="status"
      aria-label={`Average team tenure: ${formatTenureSpoken(months)}`}
    >
      <span className="tenure-stat__label">Average Tenure</span>
      <span className="tenure-stat__value tnum">{label}</span>
    </div>
  );
}

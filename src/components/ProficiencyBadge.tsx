import { PROFICIENCY_LABELS } from '../data/skillsStore';
import type { ProficiencyLevel } from '../types/skill';
import '../styles/pages/skills.css';

/** The level is always spelled out, so colour is never the only thing that tells them apart. */
export function ProficiencyBadge({ level }: { level: ProficiencyLevel }) {
  return (
    <span className={`proficiency-badge proficiency-badge--${level}`}>
      {PROFICIENCY_LABELS[level]}
    </span>
  );
}

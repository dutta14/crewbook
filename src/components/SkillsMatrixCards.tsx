import type { SkillsMatrix } from '../utils/skillsMatrix';
import '../styles/pages/skills.css';
import { Avatar } from './Avatar';
import { ProficiencyBadge } from './ProficiencyBadge';

/** The narrow-screen layout: one card per person listing only the skills they have. */
export function SkillsMatrixCards({ matrix }: { matrix: SkillsMatrix }) {
  return (
    <ul className="skills-cards" aria-label="Skills by team member">
      {matrix.members.map((member) => {
        const row = matrix.grid.get(member.id);
        const held = matrix.columns.filter((column) => row?.has(column.key));
        return (
          <li key={member.id} className="skills-cards__card">
            <h2 className="skills-cards__name">
              <Avatar name={member.name} size="sm" avatarUrl={member.avatarUrl} aria-hidden />
              {member.name}
            </h2>
            {held.length === 0 ? (
              <p className="skills-cards__none">No skills documented</p>
            ) : (
              <ul className="skills-cards__skills">
                {held.map((column) => {
                  const level = row?.get(column.key);
                  return (
                    <li key={column.key} className="skills-cards__skill">
                      <span>{column.label}</span>
                      {level ? <ProficiencyBadge level={level} /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

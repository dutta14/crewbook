import type { SkillsMatrix } from '../utils/skillsMatrix';
import '../styles/pages/skills.css';
import { Avatar } from './Avatar';
import { ProficiencyBadge } from './ProficiencyBadge';

/** A native table, so screen readers get row and column headers without extra ARIA. */
export function SkillsMatrixTable({ matrix }: { matrix: SkillsMatrix }) {
  return (
    <div className="skills-matrix__scroll">
      <table className="skills-table">
        <caption className="sr-only">Skills documented for each team member</caption>
        <thead>
          <tr>
            <th scope="col" className="skills-table__corner">
              Team member
            </th>
            {matrix.columns.map((column) => (
              <th key={column.key} scope="col" className="skills-table__skill">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.members.map((member) => (
            <tr key={member.id}>
              <th scope="row" className="skills-table__person">
                <span className="skills-table__person-inner">
                  <Avatar name={member.name} size="sm" avatarUrl={member.avatarUrl} aria-hidden />
                  {member.name}
                </span>
              </th>
              {matrix.columns.map((column) => {
                const level = matrix.grid.get(member.id)?.get(column.key);
                return (
                  <td key={column.key} className="skills-table__cell">
                    {level ? (
                      <ProficiencyBadge level={level} />
                    ) : (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Not documented</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useDeferredValue, useId, useMemo, useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { Skill } from '../types/skill';
import { buildSkillsMatrix, filterSkillsMatrix, type MatrixMember } from '../utils/skillsMatrix';
import '../styles/form.css';
import '../styles/pages/skills.css';
import { EmptyState } from './EmptyState';
import { SearchIcon, SparkIcon } from './icons';
import { SkillsMatrixCards } from './SkillsMatrixCards';
import { SkillsMatrixTable } from './SkillsMatrixTable';

interface SkillsMatrixProps {
  members: MatrixMember[];
  skills: Skill[];
}

const MOBILE_QUERY = '(max-width: 767.98px)';

function countLabel(count: number): string {
  if (count === 0) return 'No matching skills';
  return `${count} matching ${count === 1 ? 'skill' : 'skills'}`;
}

/** Everyone's skills at once. It is shown only once the manager navigates here. */
export function SkillsMatrix({ members, skills }: SkillsMatrixProps) {
  const [filter, setFilter] = useState('');
  const query = useDeferredValue(filter);
  const filterId = useId();
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const matrix = useMemo(() => buildSkillsMatrix(members, skills), [members, skills]);
  const visible = useMemo(() => filterSkillsMatrix(matrix, query), [matrix, query]);
  const isFiltering = query.trim() !== '';

  if (matrix.columns.length === 0) {
    return (
      <EmptyState
        icon={<SparkIcon size={48} />}
        title="No skills documented yet"
        description="Add skills from a team member's Skills tab and they will show up here."
      />
    );
  }

  return (
    <div className="skills-matrix">
      <p className="skills-matrix__notice">Sensitive data: avoid screen sharing.</p>
      <div className="skills-matrix__filter" role="search">
        <label className="sr-only" htmlFor={filterId}>
          Filter skills
        </label>
        <div className="search-field">
          <SearchIcon size={16} />
          <input
            id={filterId}
            type="search"
            className="form-input search-field__input"
            placeholder="Filter by skill..."
            autoComplete="off"
            maxLength={100}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      </div>
      {/* Only the count is announced. Who holds which skill is never read out unprompted. */}
      <p className="skills-matrix__count" role="status" aria-live="polite">
        {isFiltering ? countLabel(visible.columns.length) : ''}
      </p>
      {visible.columns.length === 0 ? (
        <p className="skills-matrix__none">No skill matches that filter.</p>
      ) : isMobile ? (
        <SkillsMatrixCards matrix={visible} />
      ) : (
        <SkillsMatrixTable matrix={visible} />
      )}
    </div>
  );
}

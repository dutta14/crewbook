import { describe, expect, it } from 'vitest';
import { createMember, createSkill } from '../test-utils/factories';
import { buildSkillsMatrix, filterSkillsMatrix } from './skillsMatrix';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const MEMBERS = [ALEX, PRIYA];

describe('buildSkillsMatrix', () => {
  it('sorts the columns alphabetically regardless of case', () => {
    const matrix = buildSkillsMatrix(MEMBERS, [
      createSkill({ memberId: ALEX.id, name: 'react' }),
      createSkill({ memberId: ALEX.id, name: 'Go' }),
      createSkill({ memberId: ALEX.id, name: 'Accessibility' }),
    ]);

    expect(matrix.columns.map((column) => column.label)).toEqual(['Accessibility', 'Go', 'react']);
  });

  it('shares one column between spellings and keeps the first spelling as its label', () => {
    const matrix = buildSkillsMatrix(MEMBERS, [
      createSkill({ memberId: ALEX.id, name: 'React' }),
      createSkill({ memberId: PRIYA.id, name: 'REACT' }),
    ]);

    expect(matrix.columns).toEqual([{ key: 'react', label: 'React' }]);
    expect(matrix.grid.get(PRIYA.id)?.get('react')).toBe('proficient');
  });

  it('shows the higher level when a skill is both a strength and a growth area', () => {
    const matrix = buildSkillsMatrix(MEMBERS, [
      createSkill({ memberId: ALEX.id, name: 'Go', level: 'learning', category: 'growth' }),
      createSkill({ memberId: ALEX.id, name: 'Go', level: 'expert', category: 'strength' }),
      createSkill({ memberId: ALEX.id, name: 'Go', level: 'competent', category: 'growth' }),
    ]);

    expect(matrix.grid.get(ALEX.id)?.get('go')).toBe('expert');
  });

  it('ignores skills of people who are not on the team', () => {
    const matrix = buildSkillsMatrix(MEMBERS, [createSkill({ memberId: 'gone', name: 'COBOL' })]);

    expect(matrix.columns).toEqual([]);
    expect(matrix.grid.size).toBe(0);
  });

  it('has no entry for a skill a person has not documented', () => {
    const matrix = buildSkillsMatrix(MEMBERS, [createSkill({ memberId: ALEX.id, name: 'Go' })]);

    expect(matrix.grid.get(PRIYA.id)).toBeUndefined();
  });
});

describe('filterSkillsMatrix', () => {
  const matrix = buildSkillsMatrix(MEMBERS, [
    createSkill({ memberId: ALEX.id, name: 'TypeScript' }),
    createSkill({ memberId: ALEX.id, name: 'React' }),
    createSkill({ memberId: PRIYA.id, name: 'Go' }),
  ]);

  it('returns the matrix untouched for a blank query', () => {
    expect(filterSkillsMatrix(matrix, '   ')).toBe(matrix);
  });

  it('keeps columns that contain the query, ignoring case and surrounding spaces', () => {
    const result = filterSkillsMatrix(matrix, ' SCRIPT ');

    expect(result.columns.map((column) => column.label)).toEqual(['TypeScript']);
  });

  it('keeps only the people who have a matching skill', () => {
    const result = filterSkillsMatrix(matrix, 'go');

    expect(result.members.map((member) => member.name)).toEqual(['Priya Nair']);
  });

  it('leaves nothing when no skill matches', () => {
    const result = filterSkillsMatrix(matrix, 'zzz');

    expect(result.columns).toEqual([]);
    expect(result.members).toEqual([]);
  });
});

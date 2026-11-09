import type { TeamMember } from '../types/TeamMember';
import type { ProficiencyLevel, Skill } from '../types/skill';

const LEVEL_RANK: Record<ProficiencyLevel, number> = {
  learning: 0,
  competent: 1,
  proficient: 2,
  expert: 3,
};

export type MatrixMember = Pick<TeamMember, 'id' | 'name' | 'avatarUrl'>;

export interface SkillColumn {
  /** Lower-cased name, so "react" and "React" share a column. */
  key: string;
  /** The spelling used first. */
  label: string;
}

export interface SkillsMatrix {
  members: MatrixMember[];
  /** Alphabetical. */
  columns: SkillColumn[];
  /** Member id, then column key. A missing entry means the skill is not documented. */
  grid: Map<string, Map<string, ProficiencyLevel>>;
}

const byLabel = (a: SkillColumn, b: SkillColumn) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });

/**
 * People by skills. A skill kept as both a strength and a growth area shows the higher level.
 * Skills of people no longer on the team are ignored.
 */
export function buildSkillsMatrix(members: MatrixMember[], skills: Skill[]): SkillsMatrix {
  const memberIds = new Set(members.map((member) => member.id));
  const labels = new Map<string, string>();
  const grid = new Map<string, Map<string, ProficiencyLevel>>();

  for (const skill of skills) {
    if (!memberIds.has(skill.memberId)) continue;
    const key = skill.name.toLowerCase();
    if (!labels.has(key)) labels.set(key, skill.name);
    const row = grid.get(skill.memberId) ?? new Map<string, ProficiencyLevel>();
    const current = row.get(key);
    if (current === undefined || LEVEL_RANK[skill.level] > LEVEL_RANK[current]) {
      row.set(key, skill.level);
    }
    grid.set(skill.memberId, row);
  }

  const columns = [...labels].map(([key, label]) => ({ key, label })).sort(byLabel);
  return { members, columns, grid };
}

/**
 * Keeps the columns whose name contains the query. With a query, people who have none of those
 * skills are dropped too, so what is left answers "who has this skill".
 */
export function filterSkillsMatrix(matrix: SkillsMatrix, query: string): SkillsMatrix {
  const needle = query.trim().toLowerCase();
  if (needle === '') return matrix;
  const columns = matrix.columns.filter((column) => column.key.includes(needle));
  const members = matrix.members.filter((member) =>
    columns.some((column) => matrix.grid.get(member.id)?.has(column.key)),
  );
  return { members, columns, grid: matrix.grid };
}

export type ProficiencyLevel = 'learning' | 'competent' | 'proficient' | 'expert';

/** Strengths are what a person is good at; growth areas are what they are building. */
export type SkillCategory = 'strength' | 'growth';

/** One skill a manager has documented for one person. Proficiency is an opinion, so it stays private. */
export interface Skill {
  /** crypto.randomUUID() */
  id: string;
  memberId: string;
  name: string;
  level: ProficiencyLevel;
  category: SkillCategory;
  notes: string;
  /** Reserved for a future multi-user mode. Nothing but the manager can see a skill today. */
  visibility: 'private';
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** What the manager types; everything else is set by the store. */
export interface SkillInput {
  name: string;
  level: ProficiencyLevel;
  category: SkillCategory;
  notes?: string;
}

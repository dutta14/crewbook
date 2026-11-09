import type { Skill, SkillInput } from '../types/skill';
import '../styles/pages/skills.css';
import { SkillSection } from './SkillSection';

export interface SkillsTabProps {
  skills: Skill[];
  /** Each callback rejects when the change could not be saved; a ValidationError is shown in the form. */
  onAddSkill: (input: SkillInput) => Promise<void>;
  onEditSkill: (id: string, updates: Partial<SkillInput>) => Promise<void>;
  onRemoveSkill: (id: string) => Promise<void>;
}

/** One person's skills, split into strengths and growth areas. */
export function SkillsTab({ skills, onAddSkill, onEditSkill, onRemoveSkill }: SkillsTabProps) {
  return (
    <div className="skills-tab">
      <SkillSection
        category="strength"
        headingId="strengths-heading"
        skills={skills.filter((skill) => skill.category === 'strength')}
        onAddSkill={onAddSkill}
        onEditSkill={onEditSkill}
        onRemoveSkill={onRemoveSkill}
      />
      <SkillSection
        category="growth"
        headingId="growth-heading"
        skills={skills.filter((skill) => skill.category === 'growth')}
        onAddSkill={onAddSkill}
        onEditSkill={onEditSkill}
        onRemoveSkill={onRemoveSkill}
      />
    </div>
  );
}

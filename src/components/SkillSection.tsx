import { useRef, useState } from 'react';
import { SKILL_CATEGORY_LABELS } from '../data/skillsStore';
import type { Skill, SkillCategory, SkillInput } from '../types/skill';
import '../styles/button.css';
import '../styles/pages/skills.css';
import { EmptyState } from './EmptyState';
import { SparkIcon } from './icons';
import { SkillForm, type SkillFormValues } from './SkillForm';
import { SkillRow } from './SkillRow';

interface SkillSectionProps {
  category: SkillCategory;
  headingId: string;
  skills: Skill[];
  onAddSkill: (input: SkillInput) => Promise<void>;
  onEditSkill: (id: string, updates: Partial<SkillInput>) => Promise<void>;
  onRemoveSkill: (id: string) => Promise<void>;
}

const EMPTY_TITLES: Record<SkillCategory, string> = {
  strength: 'No strengths documented yet',
  growth: 'No growth areas documented yet',
};

/** One of the two cards on the Skills tab. Only one form is open at a time. */
export function SkillSection({
  category,
  headingId,
  skills,
  onAddSkill,
  onEditSkill,
  onRemoveSkill,
}: SkillSectionProps) {
  const label = SKILL_CATEGORY_LABELS[category];
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const closeAdd = () => {
    setIsAdding(false);
    // The form is replaced by the button that opened it, so focus would otherwise be lost.
    requestAnimationFrame(() => addRef.current?.focus());
  };

  const handleAdd = async (values: SkillFormValues) => {
    await onAddSkill({ ...values, category });
    closeAdd();
  };

  const handleEdit = async (id: string, values: SkillFormValues) => {
    await onEditSkill(id, values);
    setEditingId(null);
  };

  const handleRemove = async (id: string) => {
    await onRemoveSkill(id);
    // The row that held focus is gone.
    requestAnimationFrame(() => addRef.current?.focus());
  };

  return (
    <section className="skills-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="skills-section__title">
        {label}
      </h2>
      <div className="skills-card">
        {skills.length === 0 && !isAdding ? (
          <EmptyState
            icon={<SparkIcon size={48} />}
            title={EMPTY_TITLES[category]}
            headingLevel={3}
          />
        ) : null}
        {skills.length > 0 ? (
          <ul className="skills-list" aria-label={label}>
            {skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                isEditing={editingId === skill.id}
                onStartEdit={(id) => {
                  setIsAdding(false);
                  setEditingId(id);
                }}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={handleEdit}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        ) : null}
        {isAdding ? (
          <SkillForm onSubmit={handleAdd} onCancel={closeAdd} />
        ) : (
          <button
            ref={addRef}
            type="button"
            className="btn btn-ghost skills-section__add"
            aria-label={`Add skill to ${label}`}
            onClick={() => {
              setEditingId(null);
              setIsAdding(true);
            }}
          >
            <span aria-hidden="true">+</span> Add skill
          </button>
        )}
      </div>
    </section>
  );
}

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Skill } from '../types/skill';
import '../styles/button.css';
import '../styles/pages/skills.css';
import { PencilIcon, TrashIcon } from './icons';
import { ProficiencyBadge } from './ProficiencyBadge';
import { SkillForm, type SkillFormValues } from './SkillForm';

interface SkillRowProps {
  skill: Skill;
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, values: SkillFormValues) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

/** Tracks a flag turning off, so focus can go back to the control that opened it. */
function useOnClose(isOpen: boolean, onClose: () => void) {
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (wasOpen.current && !isOpen) onClose();
    wasOpen.current = isOpen;
  });
}

export function SkillRow({
  skill,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
}: SkillRowProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const promptId = useId();
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useOnClose(isEditing, () => editRef.current?.focus());
  useOnClose(isConfirming, () => deleteRef.current?.focus());

  useEffect(() => {
    if (isConfirming) cancelRef.current?.focus();
  }, [isConfirming]);

  if (isEditing) {
    return (
      <li className="skill-row skill-row--editing">
        <SkillForm
          initial={{ name: skill.name, level: skill.level, notes: skill.notes }}
          onSubmit={(values) => onSaveEdit(skill.id, values)}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }

  const handleConfirmKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setIsConfirming(false);
  };

  const handleRemove = async () => {
    try {
      await onRemove(skill.id);
    } catch {
      // The failure has already been reported with a toast; the skill stays as it was.
      setIsConfirming(false);
    }
  };

  return (
    <li className="skill-row">
      <div className="skill-row__main">
        <div className="skill-row__heading">
          <span className="skill-row__name">{skill.name}</span>
          <ProficiencyBadge level={skill.level} />
        </div>
        {skill.notes ? <p className="skill-row__notes">{skill.notes}</p> : null}
      </div>
      {isConfirming ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- only listens for Escape
        <div
          className="skill-row__confirm"
          role="group"
          aria-labelledby={promptId}
          onKeyDown={handleConfirmKeyDown}
        >
          <span id={promptId} className="skill-row__confirm-text">
            Remove {skill.name}?
          </span>
          <button
            type="button"
            className="btn btn-ghost skill-row__confirm-btn"
            onClick={() => void handleRemove()}
          >
            Yes
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost skill-row__confirm-btn"
            onClick={() => setIsConfirming(false)}
          >
            No
          </button>
        </div>
      ) : (
        <div className="skill-row__actions">
          <button
            ref={editRef}
            type="button"
            className="icon-btn"
            aria-label={`Edit ${skill.name}`}
            onClick={() => onStartEdit(skill.id)}
          >
            <PencilIcon size={16} />
          </button>
          <button
            ref={deleteRef}
            type="button"
            className="icon-btn"
            aria-label={`Remove ${skill.name}`}
            onClick={() => setIsConfirming(true)}
          >
            <TrashIcon size={16} />
          </button>
        </div>
      )}
    </li>
  );
}

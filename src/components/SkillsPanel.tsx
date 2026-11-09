import { usePrivateEnvelope } from '../hooks/usePrivateEnvelope';
import { useSkills } from '../hooks/useSkills';
import '../styles/form.css';
import '../styles/pages/skills.css';
import { SkillsTab } from './SkillsTab';

const LOAD_FAILED = "Couldn't open skills. Lock and unlock Crewbook to try again.";

/** One person's skills. They live in the private envelope, so that is opened first. */
export function SkillsPanel({ memberId }: { memberId: string }) {
  const { isReady, loadFailed } = usePrivateEnvelope();

  if (loadFailed) {
    return (
      <p className="form-error" role="alert">
        {LOAD_FAILED}
      </p>
    );
  }
  if (!isReady) return <p className="skills__loading">Opening skills…</p>;
  return <MemberSkills memberId={memberId} />;
}

function MemberSkills({ memberId }: { memberId: string }) {
  const { skills, addSkill, editSkill, removeSkill } = useSkills(memberId);
  return (
    <SkillsTab
      skills={skills}
      onAddSkill={addSkill}
      onEditSkill={editSkill}
      onRemoveSkill={removeSkill}
    />
  );
}

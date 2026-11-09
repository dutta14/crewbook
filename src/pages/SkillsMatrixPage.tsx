import { useEffect, useMemo, useRef } from 'react';
import { SkillsMatrix } from '../components/SkillsMatrix';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { usePrivateEnvelope } from '../hooks/usePrivateEnvelope';
import { useTeamSkills } from '../hooks/useSkills';
import '../styles/form.css';
import '../styles/pages/skills.css';

const LOAD_FAILED = "Couldn't open skills. Lock and unlock Crewbook to try again.";

/** Manager-only, and rendered only once the manager navigates here. */
export function SkillsMatrixPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { isReady, loadFailed } = usePrivateEnvelope();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="skills-page__title">
        Skills Matrix
      </h1>
      {loadFailed ? (
        <p className="form-error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : isReady ? (
        <LoadedMatrix />
      ) : (
        <p className="skills__loading">Opening skills…</p>
      )}
    </>
  );
}

function LoadedMatrix() {
  const storage = useEncryptedStorage();
  const members = useMemo(
    () =>
      listMembers(storage)
        .map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [storage],
  );
  const skills = useTeamSkills();
  return <SkillsMatrix members={members} skills={skills} />;
}

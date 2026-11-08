import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DecisionFollowUpList } from '../components/DecisionFollowUpList';
import { getDecisions, getFollowUps } from '../data/decisions';
import { listMembers } from '../data/members';
import { listNoteIds } from '../data/notes';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useFollowUpStatusChange } from '../hooks/useFollowUpStatusChange';
import '../styles/decisions.css';
import '../styles/form.css';

const ALL_PEOPLE = 'all';
const LOAD_FAILED = "Couldn't open your decisions. Lock and unlock Crewbook to try again.";

/** Every decision and follow-up across the team, so this page is as sensitive as all the 1:1 notes. */
export function DecisionsGlobalView() {
  const { isPrivateUnlocked, loadPrivate } = useEncryptedStorage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let isCurrent = true;
    loadPrivate().catch(() => {
      if (isCurrent) setLoadFailed(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [loadPrivate]);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="decisions-page__title">
        Decisions &amp; Follow-ups
      </h1>
      {loadFailed ? (
        <p className="form-error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : isPrivateUnlocked ? (
        <GlobalList />
      ) : (
        <p className="decision-list__loading">Opening your decisions…</p>
      )}
    </>
  );
}

function GlobalList() {
  const storage = useEncryptedStorage();
  const onStatusChange = useFollowUpStatusChange();
  const personSelectId = useId();
  // Component state only; a person's id must never end up in the URL.
  const [personId, setPersonId] = useState(ALL_PEOPLE);

  const members = useMemo(() => listMembers(storage), [storage]);
  const meetingIds = useMemo(() => listNoteIds(storage), [storage]);
  const { decisions, followUps } = useMemo(() => {
    // Records of a member who no longer exists have no person to show.
    const known = new Set(members.map((member) => member.id));
    const isShown = ({ engineerId }: { engineerId: string }) =>
      known.has(engineerId) && (personId === ALL_PEOPLE || engineerId === personId);
    return {
      decisions: getDecisions(storage).filter(isShown),
      followUps: getFollowUps(storage).filter(isShown),
    };
  }, [storage, members, personId]);

  return (
    <DecisionFollowUpList
      decisions={decisions}
      followUps={followUps}
      members={members}
      meetingIds={meetingIds}
      onStatusChange={onStatusChange}
      showPerson
      toolbar={
        <div className="decisions-page__person">
          <label htmlFor={personSelectId}>Person</label>
          <select
            id={personSelectId}
            className="form-input"
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
          >
            <option value={ALL_PEOPLE}>All team members</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      }
    />
  );
}

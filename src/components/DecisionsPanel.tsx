import { useEffect, useMemo, useState } from 'react';
import { getDecisions, getFollowUps } from '../data/decisions';
import { listMembers } from '../data/members';
import { listNoteIds } from '../data/notes';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useFollowUpStatusChange } from '../hooks/useFollowUpStatusChange';
import '../styles/form.css';
import { DecisionFollowUpList } from './DecisionFollowUpList';

interface DecisionsPanelProps {
  memberId: string;
}

const LOAD_FAILED = "Couldn't open your decisions. Lock and unlock Crewbook to try again.";

/** One person's decisions and follow-ups. They live in the private envelope, so it is loaded first. */
export function DecisionsPanel({ memberId }: DecisionsPanelProps) {
  const { isPrivateUnlocked, loadPrivate } = useEncryptedStorage();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    loadPrivate().catch(() => {
      if (isCurrent) setLoadFailed(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [loadPrivate]);

  if (loadFailed) {
    return (
      <p className="form-error" role="alert">
        {LOAD_FAILED}
      </p>
    );
  }
  if (!isPrivateUnlocked) return <p className="decision-list__loading">Opening your decisions…</p>;
  return <LoadedDecisions memberId={memberId} />;
}

function LoadedDecisions({ memberId }: DecisionsPanelProps) {
  const storage = useEncryptedStorage();
  const onStatusChange = useFollowUpStatusChange();
  const decisions = useMemo(() => getDecisions(storage, memberId), [storage, memberId]);
  const followUps = useMemo(() => getFollowUps(storage, memberId), [storage, memberId]);
  const members = useMemo(() => listMembers(storage), [storage]);
  const meetingIds = useMemo(() => listNoteIds(storage), [storage]);

  return (
    <DecisionFollowUpList
      decisions={decisions}
      followUps={followUps}
      members={members}
      meetingIds={meetingIds}
      onStatusChange={onStatusChange}
    />
  );
}

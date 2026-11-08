import { usePrivateEnvelope } from '../hooks/usePrivateEnvelope';
import type { TeamMember } from '../types/TeamMember';
import '../styles/form.css';
import { GrowthTimeline } from './GrowthTimeline';

interface GrowthPanelProps {
  member: Pick<TeamMember, 'id' | 'name' | 'role' | 'level'>;
}

const LOAD_FAILED = "Couldn't open growth history. Lock and unlock Crewbook to try again.";

/** One person's growth history. It lives in the private envelope, so that is opened first. */
export function GrowthPanel({ member }: GrowthPanelProps) {
  const { isReady, loadFailed } = usePrivateEnvelope();

  if (loadFailed) {
    return (
      <p className="form-error" role="alert">
        {LOAD_FAILED}
      </p>
    );
  }
  if (!isReady) return <p className="growth__loading">Opening growth history…</p>;
  return <GrowthTimeline member={member} />;
}

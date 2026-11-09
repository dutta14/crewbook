import { usePrivateEnvelope } from '../hooks/usePrivateEnvelope';
import type { TeamMember } from '../types/TeamMember';
import '../styles/form.css';
import '../styles/feedback.css';
import { FeedbackLog } from './FeedbackLog';

interface FeedbackPanelProps {
  /** One person's log, for their profile. Without it, everyone's, for the Feedback page. */
  member?: Pick<TeamMember, 'id'>;
}

const LOAD_FAILED = "Couldn't open feedback. Lock and unlock Crewbook to try again.";

/** Feedback lives in the private envelope, so that is opened before anything is shown. */
export function FeedbackPanel({ member }: FeedbackPanelProps) {
  const { isReady, loadFailed } = usePrivateEnvelope();

  if (loadFailed) {
    return (
      <p className="form-error" role="alert">
        {LOAD_FAILED}
      </p>
    );
  }
  if (!isReady) return <p className="feedback-log__loading">Opening feedback…</p>;
  return member ? (
    <FeedbackLog engineerId={member.id} />
  ) : (
    <FeedbackLog headingLevel={1} focusHeadingOnMount />
  );
}

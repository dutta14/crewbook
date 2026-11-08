import '../styles/button.css';
import '../styles/pages/live-mode.css';

interface LiveModeNoticeProps {
  onDismiss: () => void;
}

/** Shown once. It reminds the manager to be open with the team about taking notes. */
export function LiveModeNotice({ onDismiss }: LiveModeNoticeProps) {
  return (
    <div className="live-mode__notice">
      <p>
        Live mode captures notes as you type. Consider letting your team members know you take notes
        during 1:1s.
      </p>
      <button type="button" className="btn btn-secondary" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

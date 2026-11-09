import { useMatch } from 'react-router-dom';
import { useFeedbackQuickAdd } from '../hooks/useFeedbackQuickAdd';
import '../styles/feedback.css';
import { PlusIcon } from './icons';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Quick-add from any screen on a phone. It is always mounted and hidden by CSS from 768px up,
 * where the page has its own buttons. On a profile it starts with that person selected.
 */
export function FeedbackFab() {
  const { openQuickAdd, quickAddModal } = useFeedbackQuickAdd();
  const profile = useMatch('/person/:id');
  const personId = profile?.params.id;

  return (
    <>
      <button
        type="button"
        className="feedback-fab"
        aria-label="Log feedback"
        onClick={() =>
          void openQuickAdd(personId && UUID_PATTERN.test(personId) ? personId : undefined)
        }
      >
        <PlusIcon size={24} />
      </button>
      {quickAddModal}
    </>
  );
}

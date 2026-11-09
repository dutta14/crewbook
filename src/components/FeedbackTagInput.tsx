import { useId, useState, type KeyboardEvent } from 'react';
import {
  FEEDBACK_MAX_TAGS,
  FEEDBACK_TAG_MAX_LENGTH,
  FEEDBACK_TAG_PATTERN,
} from '../data/feedbackStore';
import { CloseIcon } from './icons';

interface FeedbackTagInputProps {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

/** Type a tag and press Enter or comma. Tags show as removable pills. */
export function FeedbackTagInput({ id, tags, onChange }: FeedbackTagInputProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const errorId = useId();
  const atLimit = tags.length >= FEEDBACK_MAX_TAGS;

  const commit = (): boolean => {
    const tag = draft.trim().toLowerCase();
    if (tag === '') return true;
    if (tag.length > FEEDBACK_TAG_MAX_LENGTH) {
      setError(`Tags must be ${FEEDBACK_TAG_MAX_LENGTH} characters or fewer`);
      return false;
    }
    if (!FEEDBACK_TAG_PATTERN.test(tag)) {
      setError('Tags can use letters, numbers and hyphens only');
      return false;
    }
    setError('');
    setDraft('');
    if (!tags.includes(tag) && !atLimit) onChange([...tags, tag]);
    return true;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter must not submit the form while a tag is being typed.
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="feedback-tags">
      {tags.length > 0 ? (
        <ul className="feedback-tags__list" aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag} className="feedback-tag">
              <span>{tag}</span>
              <button
                type="button"
                className="feedback-tag__remove"
                aria-label={`Remove tag: ${tag}`}
                onClick={() => onChange(tags.filter((item) => item !== tag))}
              >
                <CloseIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        type="text"
        className="form-input"
        autoComplete="off"
        aria-label="Add tags"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        placeholder={atLimit ? 'Tag limit reached' : 'Add a tag, then press Enter'}
        maxLength={FEEDBACK_TAG_MAX_LENGTH + 1}
        disabled={atLimit}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError('');
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim() !== '') commit();
        }}
      />
      {error ? (
        <span id={errorId} className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

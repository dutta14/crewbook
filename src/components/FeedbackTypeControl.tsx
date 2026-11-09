import { useId } from 'react';
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS } from '../data/feedbackStore';
import type { FeedbackType } from '../types/feedback';
import '../styles/feedback.css';

interface FeedbackTypeControlProps {
  value: FeedbackType;
  onChange: (value: FeedbackType) => void;
}

/** Three native radios drawn as a segmented control, so arrow keys and checked state come free. */
export function FeedbackTypeControl({ value, onChange }: FeedbackTypeControlProps) {
  const name = useId();
  const index = FEEDBACK_TYPES.indexOf(value);

  return (
    <div
      className="feedback-type"
      role="radiogroup"
      aria-label="Feedback type"
      style={{ '--feedback-type-index': index } as React.CSSProperties}
    >
      <span className="feedback-type__indicator" data-type={value} aria-hidden="true" />
      {FEEDBACK_TYPES.map((type) => (
        <label key={type} className="feedback-type__option">
          <input
            type="radio"
            name={name}
            className="feedback-type__input"
            value={type}
            checked={type === value}
            onChange={() => onChange(type)}
          />
          <span className="feedback-type__label">{FEEDBACK_TYPE_LABELS[type]}</span>
        </label>
      ))}
    </div>
  );
}

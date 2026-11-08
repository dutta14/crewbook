import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { MoodScore } from '../types/MoodEntry';
import { MOOD_LABELS, MOOD_SCORES } from '../utils/moodScale';
import '../styles/mood.css';
import { LockIcon } from './icons';

interface MoodSelectorProps {
  value: MoodScore | null;
  /** Receives the chosen score, or null when the selected score is clicked again. */
  onChange: (value: MoodScore | null) => void;
  /** True when mood tracking is off in settings; nothing renders. */
  disabled?: boolean;
}

/** Optional 5-point energy scale. A radiogroup with one tab stop and arrow keys to move focus. */
export function MoodSelector({ value, onChange, disabled = false }: MoodSelectorProps) {
  const legendId = useId();
  const [focusScore, setFocusScore] = useState<MoodScore>(value ?? 1);
  const buttons = useRef(new Map<MoodScore, HTMLButtonElement>());

  if (disabled) return null;

  const tabStop = value ?? focusScore;

  const moveFocus = (target: number) => {
    const next = MOOD_SCORES[(target + MOOD_SCORES.length) % MOOD_SCORES.length];
    setFocusScore(next);
    buttons.current.get(next)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: MOOD_SCORES.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    moveFocus(moves[event.key]);
  };

  return (
    <fieldset className="mood-selector" role="radiogroup" aria-labelledby={legendId}>
      <legend id={legendId} className="sr-only">
        Energy level
      </legend>
      <div className="mood-selector__header">
        <span className="mood-selector__prompt">How did they seem?</span>
        <span className="mood-selector__private">
          <LockIcon size={16} />
          Private
        </span>
      </div>
      <div className="mood-selector__options">
        {MOOD_SCORES.map((score, index) => (
          <button
            key={score}
            ref={(node) => {
              if (node) buttons.current.set(score, node);
              else buttons.current.delete(score);
            }}
            type="button"
            role="radio"
            className="mood-btn"
            aria-checked={value === score}
            aria-label={MOOD_LABELS[score].label}
            tabIndex={tabStop === score ? 0 : -1}
            onFocus={() => setFocusScore(score)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(value === score ? null : score)}
          >
            <span aria-hidden="true">{MOOD_LABELS[score].emoji}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

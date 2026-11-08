import { useEffect, useRef, useState } from 'react';
import { dismissPrep, isPrepDismissed } from '../data/prepDismissal';
import { usePrepData } from '../hooks/usePrepData';
import type { PrepData } from '../types/prep';
import '../styles/button.css';
import '../styles/prep-prompts.css';
import '../styles/utilities.css';
import { ErrorBoundary } from './ErrorBoundary';
import { ChevronDownIcon, CloseIcon } from './icons';
import { StatusBadge, toBadgeStatus } from './StatusBadge';

interface PrepPromptsProps {
  memberId: string;
  className?: string;
}

export const MAX_VISIBLE_ACTION_ITEMS = 5;

const HEADING_ID = 'prep-heading';
const CONTENT_ID = 'prep-content';
// Matches the fade in prep-prompts.css.
const DISMISS_DURATION_MS = 250;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const HIDDEN_SELECTOR = '[inert], [hidden], [aria-hidden="true"]';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Moves focus to the next control in page order that is not inside the card, else the previous. */
function moveFocusOutside(card: HTMLElement, from: HTMLElement) {
  const scope = card.closest('[role="dialog"]') ?? document;
  const controls = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (control) => !card.contains(control) && !control.closest(HIDDEN_SELECTOR),
  );
  const next = controls.find(
    (control) => from.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  (next ?? controls[controls.length - 1])?.focus();
}

/**
 * Context to read before a 1:1: how long it has been, what is still open, what was discussed last
 * and any status changes. It can be collapsed, and dismissed for the rest of the session. Renders
 * nothing when there is no earlier 1:1 to prepare from.
 */
export function PrepPrompts({ memberId, className }: PrepPromptsProps) {
  return (
    // A failure here must not take the page down, and its report must not carry note content.
    <ErrorBoundary silent fallback={null}>
      <PrepCard memberId={memberId} className={className} />
    </ErrorBoundary>
  );
}

function PrepCard({ memberId, className }: PrepPromptsProps) {
  const data = usePrepData(memberId);
  const cardRef = useRef<HTMLElement>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [phase, setPhase] = useState<'shown' | 'dismissing' | 'gone'>(() =>
    isPrepDismissed() ? 'gone' : 'shown',
  );

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );

  if (!data || phase === 'gone') return null;

  const handleDismiss = (button: HTMLButtonElement) => {
    if (cardRef.current) moveFocusOutside(cardRef.current, button);
    dismissPrep();
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      setPhase('gone');
      return;
    }
    setPhase('dismissing');
    dismissTimer.current = setTimeout(() => setPhase('gone'), DISMISS_DURATION_MS);
  };

  const classes = [
    'prep-card',
    isCollapsed ? 'prep-card--collapsed' : '',
    phase === 'dismissing' ? 'prep-card--dismissing' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section ref={cardRef} className={classes} aria-labelledby={HEADING_ID}>
      <div className="prep-card__header">
        <h3 id={HEADING_ID} className="prep-card__title">
          PREP
        </h3>
        <div className="prep-card__controls">
          <button
            type="button"
            className="icon-btn prep-card__toggle"
            aria-label={isCollapsed ? 'Expand prep' : 'Collapse prep'}
            aria-expanded={!isCollapsed}
            aria-controls={CONTENT_ID}
            onClick={() => setIsCollapsed((current) => !current)}
          >
            <ChevronDownIcon size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss prep prompts"
            onClick={(event) => handleDismiss(event.currentTarget)}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>
      <div
        id={CONTENT_ID}
        className="prep-card__content"
        aria-hidden={isCollapsed || undefined}
        inert={isCollapsed}
      >
        <div className="prep-card__inner">
          <PrepBody data={data} />
        </div>
      </div>
    </section>
  );
}

function PrepBody({ data }: { data: PrepData }) {
  const [showAll, setShowAll] = useState(false);
  const { daysSinceLastMeeting: days, openActionItems: items } = data;
  const visible = showAll ? items : items.slice(0, MAX_VISIBLE_ACTION_ITEMS);
  const hiddenCount = items.length - MAX_VISIBLE_ACTION_ITEMS;

  return (
    <>
      <p className={`prep-card__days${data.isOverdue ? ' prep-card__days--warning' : ''}`}>
        {days === 0 ? (
          'Last 1:1 was today'
        ) : (
          <>
            <span className="prep-card__count">{plural(days, 'day')}</span> since last 1:1
          </>
        )}
        {data.isOverdue ? (
          <span role="status" className="sr-only">
            {`Warning: ${plural(days, 'day')} since last 1:1, exceeds usual cadence`}
          </span>
        ) : null}
      </p>
      <div className="prep-card__block">
        <p className="prep-card__label">Open action items</p>
        {items.length === 0 ? (
          <p className="prep-card__muted">None open</p>
        ) : (
          <>
            <ul className="prep-card__list">
              {visible.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ul>
            {hiddenCount > 0 ? (
              <button
                type="button"
                className="prep-card__more"
                aria-expanded={showAll}
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll ? 'Show fewer' : `+${hiddenCount} more`}
              </button>
            ) : null}
          </>
        )}
      </div>
      {data.lastDiscussedSummary ? (
        <div className="prep-card__block">
          <p className="prep-card__label">Last time you discussed:</p>
          <p className="prep-card__summary">{data.lastDiscussedSummary}</p>
        </div>
      ) : null}
      {data.recentStatusChanges.length > 0 ? (
        <ul className="prep-card__changes">
          {data.recentStatusChanges.map((change) => (
            <li key={change.changedAt + change.status} className="prep-card__change">
              <span>Changed to</span>
              <StatusBadge status={toBadgeStatus(change.status)} size="sm" />
              <span className="prep-card__ago">
                {change.daysAgo === 0 ? 'today' : `${plural(change.daysAgo, 'day')} ago`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="prep-card__muted">No reminders</p>
    </>
  );
}

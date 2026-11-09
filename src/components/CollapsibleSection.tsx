import { useState, type ReactNode } from 'react';
import '../styles/shared-action-items.css';
import { ChevronRightIcon } from './icons';

interface CollapsibleSectionProps {
  title: string;
  count: number;
  /** Id of the content, which the toggle controls. */
  contentId: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/** A heading-less toggle with a count. The content is not rendered while collapsed. */
export function CollapsibleSection({
  title,
  count,
  contentId,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible">
      <button
        type="button"
        className="collapsible__toggle"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span
          className={`collapsible__chevron${expanded ? ' collapsible__chevron--open' : ''}`}
          aria-hidden="true"
        >
          <ChevronRightIcon size={20} />
        </span>
        <span>{`${title} (${count})`}</span>
      </button>
      {expanded ? (
        <div id={contentId} className="collapsible__content">
          {children}
        </div>
      ) : null}
    </div>
  );
}

import { useState, type CSSProperties, type ReactNode } from 'react';
import { readCollapseState, setSectionCollapsed } from '../data/dashboardCollapse';
import '../styles/dashboard.css';
import { ChevronDownIcon } from './icons';

interface BriefingSectionProps {
  /** Used for aria-controls, the heading id and the saved collapse state. */
  id: string;
  title: string;
  count: number;
  children: ReactNode;
  defaultCollapsed?: boolean;
  /** Position in the grid, which staggers the entrance. */
  index?: number;
}

/** A card that can be folded away to its header. Whether it is folded is remembered. */
export function BriefingSection({
  id,
  title,
  count,
  children,
  defaultCollapsed = false,
  index = 0,
}: BriefingSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => readCollapseState()[id] ?? defaultCollapsed);
  const headingId = `${id}-heading`;
  const contentId = `${id}-content`;

  const toggle = () => {
    setIsCollapsed(!isCollapsed);
    setSectionCollapsed(id, !isCollapsed);
  };

  return (
    <section
      className="briefing-section"
      aria-labelledby={headingId}
      style={{ '--section-index': index } as CSSProperties}
    >
      <div className="briefing-section__header">
        <h3 id={headingId} className="briefing-section__heading">
          {title}
        </h3>
        <span
          className="briefing-section__count"
          role="img"
          aria-label={`${count} ${count === 1 ? 'item' : 'items'}`}
        >
          {count}
        </span>
        <button
          type="button"
          className="briefing-section__toggle"
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          aria-label={`Toggle ${title}`}
          onClick={toggle}
        >
          <span
            className={`briefing-section__chevron${isCollapsed ? ' briefing-section__chevron--collapsed' : ''}`}
          >
            <ChevronDownIcon size={16} />
          </span>
        </button>
      </div>
      <div id={contentId} className="briefing-section__content" hidden={isCollapsed}>
        {children}
      </div>
    </section>
  );
}

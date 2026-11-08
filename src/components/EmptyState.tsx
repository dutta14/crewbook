import type { ReactNode, Ref } from 'react';
import '../styles/button.css';
import './EmptyState.css';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** The heading level; use 1 when the empty state is the page's only heading. */
  headingLevel?: 1 | 2;
  /** Makes the heading programmatically focusable so a page can move focus to it. */
  titleRef?: Ref<HTMLHeadingElement>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 2,
  titleRef,
}: EmptyStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <Heading ref={titleRef} className="empty-state__title" tabIndex={titleRef ? -1 : undefined}>
        {title}
      </Heading>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? (
        <button type="button" className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

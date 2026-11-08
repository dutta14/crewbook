import type { ReactNode } from 'react';
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
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className="empty-state__title">{title}</h2>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? (
        <button type="button" className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

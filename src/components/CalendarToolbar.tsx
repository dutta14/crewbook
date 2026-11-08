import type { KeyboardEvent } from 'react';
import '../styles/button.css';
import '../styles/calendar.css';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export type CalendarView = 'week' | 'month';

const VIEWS: Array<{ value: CalendarView; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  /** e.g. "November 2026". Announced politely when it changes. */
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  tabId: (view: CalendarView) => string;
  panelId: string;
}

export function CalendarToolbar({
  view,
  onViewChange,
  label,
  onPrevious,
  onNext,
  onToday,
  tabId,
  panelId,
}: CalendarToolbarProps) {
  const unit = view === 'week' ? 'week' : 'month';

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = VIEWS[(VIEWS.findIndex((item) => item.value === view) + 1) % VIEWS.length];
    onViewChange(next.value);
    document.getElementById(tabId(next.value))?.focus();
  };

  return (
    <div className="calendar-toolbar">
      <div className="calendar-toolbar__nav">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Previous ${unit}`}
          onClick={onPrevious}
        >
          <ChevronLeftIcon />
        </button>
        <button type="button" className="icon-btn" aria-label={`Next ${unit}`} onClick={onNext}>
          <ChevronRightIcon />
        </button>
        <button type="button" className="btn btn-secondary" onClick={onToday}>
          Today
        </button>
        <h2 className="calendar-toolbar__label" aria-live="polite">
          {label}
        </h2>
      </div>
      <div className="calendar-toggle" role="tablist" aria-label="Calendar view">
        {VIEWS.map((item) => {
          const isSelected = item.value === view;
          return (
            <button
              key={item.value}
              id={tabId(item.value)}
              type="button"
              role="tab"
              className="calendar-toggle__tab"
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onViewChange(item.value)}
              onKeyDown={handleTabKeyDown}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

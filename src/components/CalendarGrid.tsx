import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { leaveCoversDay, peopleOutOn } from '../data/leave';
import type { LeaveEntry } from '../types/leave';
import type { TeamMember } from '../types/TeamMember';
import type { FirstDayOfWeek } from '../types/settings';
import {
  addDays,
  addMonths,
  dayOfMonth,
  formatLongDay,
  formatMonthLabel,
  formatWeekLabel,
  formatWeekday,
  getMonthWeeks,
  getWeekDays,
  isSameMonth,
  startOfWeek,
} from '../utils/calendarDates';
import '../styles/calendar.css';
import { CalendarToolbar, type CalendarView } from './CalendarToolbar';
import { WarningIcon } from './icons';
import { LeaveChip } from './LeaveChip';

const MAX_CHIPS_PER_DAY = 3;

interface CalendarGridProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  /** Any day inside the period being shown. Also the day that holds keyboard focus. */
  cursor: string;
  onCursorChange: (day: string) => void;
  entries: LeaveEntry[];
  members: TeamMember[];
  /** YYYY-MM-DD */
  today: string;
  /** The weekday the grid starts on. Defaults to Monday. */
  firstDay?: FirstDayOfWeek;
  onSelectEntry: (entry: LeaveEntry) => void;
}

/** Where each key moves the focused day. */
function moveFocus(key: string, day: string, firstDay: FirstDayOfWeek): string | null {
  switch (key) {
    case 'ArrowLeft':
      return addDays(day, -1);
    case 'ArrowRight':
      return addDays(day, 1);
    case 'ArrowUp':
      return addDays(day, -7);
    case 'ArrowDown':
      return addDays(day, 7);
    case 'Home':
      return startOfWeek(day, firstDay);
    case 'End':
      return addDays(startOfWeek(day, firstDay), 6);
    case 'PageUp':
      return addMonths(day, -1);
    case 'PageDown':
      return addMonths(day, 1);
    default:
      return null;
  }
}

export function CalendarGrid({
  view,
  onViewChange,
  cursor,
  onCursorChange,
  entries,
  members,
  today,
  firstDay = 'monday',
  onSelectEntry,
}: CalendarGridProps) {
  const baseId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusCursor = useRef(false);
  const [expandedDays, setExpandedDays] = useState<ReadonlySet<string>>(new Set());

  const peopleById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  // An entry whose person is no longer on the team has nothing to show.
  const visibleEntries = useMemo(
    () => entries.filter((entry) => peopleById.has(entry.memberId)),
    [entries, peopleById],
  );

  const rows = view === 'week' ? [getWeekDays(cursor, firstDay)] : getMonthWeeks(cursor, firstDay);
  const tabId = (value: CalendarView) => `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel`;

  // Moving focus has to wait for the new period to render.
  useEffect(() => {
    if (!shouldFocusCursor.current) return;
    shouldFocusCursor.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${cursor}"]`)?.focus();
  }, [cursor, view]);

  const shift = (direction: -1 | 1) =>
    onCursorChange(view === 'week' ? addDays(cursor, direction * 7) : addMonths(cursor, direction));

  const handleCellKeyDown = (event: KeyboardEvent<HTMLDivElement>, day: string) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      const first = visibleEntries.find((entry) => leaveCoversDay(entry, day));
      if (first) {
        event.preventDefault();
        onSelectEntry(first);
      }
      return;
    }
    const target = moveFocus(event.key, day, firstDay);
    if (target === null) return;
    event.preventDefault();
    shouldFocusCursor.current = true;
    onCursorChange(target);
  };

  const toggleExpanded = (day: string) =>
    setExpandedDays((current) => {
      const next = new Set(current);
      if (!next.delete(day)) next.add(day);
      return next;
    });

  return (
    <div className="calendar">
      <CalendarToolbar
        view={view}
        onViewChange={onViewChange}
        label={view === 'week' ? formatWeekLabel(cursor) : formatMonthLabel(cursor)}
        onPrevious={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => onCursorChange(today)}
        tabId={tabId}
        panelId={panelId}
      />
      <div id={panelId} role="tabpanel" aria-labelledby={tabId(view)}>
        <div
          ref={gridRef}
          className={`calendar-grid calendar-grid--${view}`}
          role="grid"
          aria-label={`Leave calendar, ${view} view`}
        >
          <div className="calendar-grid__row" role="row">
            {getWeekDays(cursor, firstDay).map((day) => (
              <div key={day} className="calendar-grid__heading" role="columnheader">
                {formatWeekday(day)}
              </div>
            ))}
          </div>
          {rows.map((week) => (
            <div key={week[0]} className="calendar-grid__row" role="row">
              {week.map((day) => {
                const dayEntries = visibleEntries
                  .filter((entry) => leaveCoversDay(entry, day))
                  .sort(
                    (a, b) =>
                      (peopleById.get(a.memberId)?.name ?? '').localeCompare(
                        peopleById.get(b.memberId)?.name ?? '',
                      ) || a.startDate.localeCompare(b.startDate),
                  );
                return (
                  <DayCell
                    key={day}
                    day={day}
                    view={view}
                    isToday={day === today}
                    isOutsideMonth={view === 'month' && !isSameMonth(day, cursor)}
                    isFocused={day === cursor}
                    entries={dayEntries}
                    peopleById={peopleById}
                    overlapCount={peopleOutOn(dayEntries, day).length}
                    isExpanded={expandedDays.has(day)}
                    onToggleExpanded={() => toggleExpanded(day)}
                    onFocusDay={() => onCursorChange(day)}
                    onKeyDown={(event) => handleCellKeyDown(event, day)}
                    onSelectEntry={onSelectEntry}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DayCellProps {
  day: string;
  view: CalendarView;
  isToday: boolean;
  isOutsideMonth: boolean;
  isFocused: boolean;
  entries: LeaveEntry[];
  peopleById: ReadonlyMap<string, TeamMember>;
  overlapCount: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onFocusDay: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onSelectEntry: (entry: LeaveEntry) => void;
}

function DayCell({
  day,
  view,
  isToday,
  isOutsideMonth,
  isFocused,
  entries,
  peopleById,
  overlapCount,
  isExpanded,
  onToggleExpanded,
  onFocusDay,
  onKeyDown,
  onSelectEntry,
}: DayCellProps) {
  const isOverlap = overlapCount >= 2;
  const limit = view === 'month' && !isExpanded ? MAX_CHIPS_PER_DAY : entries.length;
  const shown = entries.slice(0, limit);
  const hiddenCount = entries.length - shown.length;
  const classes = [
    'calendar-cell',
    isOutsideMonth ? 'calendar-cell--outside' : '',
    isOverlap ? 'calendar-cell--overlap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      role="gridcell"
      data-day={day}
      aria-label={formatLongDay(day)}
      tabIndex={isFocused ? 0 : -1}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        if (event.target === event.currentTarget && !isFocused) onFocusDay();
      }}
    >
      <div className="calendar-cell__header">
        <span
          className={`calendar-cell__number${isToday ? ' calendar-cell__number--today' : ''}`}
          {...(isToday ? { 'aria-current': 'date' as const } : {})}
        >
          {dayOfMonth(day)}
        </span>
        {isOverlap ? (
          <span
            className="calendar-cell__overlap"
            role="img"
            aria-label={`Overlap: ${overlapCount} people out on ${formatLongDay(day)}`}
          >
            <WarningIcon size={14} />
          </span>
        ) : null}
      </div>
      <div className="calendar-cell__entries">
        {shown.map((entry) => {
          const member = peopleById.get(entry.memberId);
          return member ? (
            <LeaveChip
              key={entry.id}
              entry={entry}
              member={member}
              variant={view === 'week' ? 'bar' : 'chip'}
              tabIndex={isFocused ? 0 : -1}
              onSelect={onSelectEntry}
            />
          ) : null;
        })}
        {hiddenCount > 0 ? (
          <button
            type="button"
            className="calendar-cell__more"
            aria-expanded={false}
            aria-label={`${hiddenCount} more leave entries, click to expand`}
            tabIndex={isFocused ? 0 : -1}
            onClick={onToggleExpanded}
          >
            +{hiddenCount} more
          </button>
        ) : null}
        {isExpanded && view === 'month' && entries.length > MAX_CHIPS_PER_DAY ? (
          <button
            type="button"
            className="calendar-cell__more"
            aria-expanded
            aria-label="Show fewer leave entries"
            tabIndex={isFocused ? 0 : -1}
            onClick={onToggleExpanded}
          >
            Show fewer
          </button>
        ) : null}
      </div>
    </div>
  );
}

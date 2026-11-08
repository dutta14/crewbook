import { useId, useState, type CSSProperties, type ChangeEvent } from 'react';
import type { TenureBar, TenureScale, TenureSortField } from '../types/tenure';
import { parseIsoDate } from '../utils/scheduleCalculator';
import { formatStartDate } from '../utils/startDate';
import {
  formatMonthYear,
  formatTenureShort,
  isTenureSortField,
  tenureStatusLabel,
} from '../utils/tenure';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { TeamIcon } from './icons';
import '../styles/form.css';
import '../styles/tenure.css';

interface TenureChartProps {
  /** In display order. */
  bars: TenureBar[];
  timeScale: TenureScale;
  /** Positions the Today marker. */
  today: Date;
  sortField: TenureSortField;
  onSortChange: (field: TenureSortField) => void;
}

const SORT_OPTIONS: Array<{ value: TenureSortField; label: string }> = [
  { value: 'startDate', label: 'Start date' },
  { value: 'tenureLength', label: 'Tenure length' },
  { value: 'name', label: 'Name' },
];

const PX_PER_YEAR = 140;
const MIN_PLOT_WIDTH = 480;
const PLOT_PADDING_RIGHT = 16;
const MIN_BAR_WIDTH = 40;
const ROW_HEIGHT = 44;
const ROW_GAP = 8;
const BAR_HEIGHT = 20;
const TOP = 28;
const AXIS_HEIGHT = 28;
const TOOLTIP_HALF_WIDTH = 110;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const dayNumber = (isoDate: string): number => {
  const day = parseIsoDate(isoDate);
  return day ? Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / MS_PER_DAY : 0;
};

const toDayNumber = (day: Date): number =>
  Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / MS_PER_DAY;

interface Placement {
  x: number;
  width: number;
  rowTop: number;
}

export function TenureChart({ bars, timeScale, today, sortField, onSortChange }: TenureChartProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Bars are remounted on every re-sort so the cross-fade replays; 0 means the first render.
  const [sortCount, setSortCount] = useState(0);
  const selectId = useId();

  if (bars.length === 0) {
    return (
      <EmptyState
        icon={<TeamIcon size={48} />}
        title="Add team members to see tenure data"
        description="Each person's time on your team shows up here once they are on your roster."
      />
    );
  }

  const minDay = dayNumber(timeScale.minDate);
  const spanDays = Math.max(1, dayNumber(timeScale.maxDate) - minDay);
  const plotWidth = Math.max(MIN_PLOT_WIDTH, timeScale.years.length * PX_PER_YEAR);
  const xOf = (day: number) => ((day - minDay) / spanDays) * plotWidth;
  const svgWidth = plotWidth + PLOT_PADDING_RIGHT;
  const rowsHeight = bars.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP;
  const svgHeight = TOP + rowsHeight + AXIS_HEIGHT;
  const todayX = xOf(toDayNumber(today));

  const place = (bar: TenureBar, index: number): Placement => {
    // A hire who has not started yet is drawn from today out to their start date.
    const from = bar.startsInFuture ? toDayNumber(today) : dayNumber(bar.startDate);
    const to = bar.startsInFuture ? dayNumber(bar.startDate) : dayNumber(bar.endDate);
    const x = xOf(from);
    return {
      x,
      width: Math.max(MIN_BAR_WIDTH, xOf(to) - x),
      rowTop: TOP + index * (ROW_HEIGHT + ROW_GAP),
    };
  };

  const activeIndex = activeId === null ? -1 : bars.findIndex((bar) => bar.engineerId === activeId);
  const activeBar = activeIndex === -1 ? null : bars[activeIndex];
  const activePlacement = activeBar ? place(activeBar, activeIndex) : null;

  const handleSort = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (!isTenureSortField(value)) return;
    onSortChange(value);
    setActiveId(null);
    setSortCount((count) => count + 1);
  };

  return (
    <section className="tenure-chart" aria-label="Team tenure">
      <div className="tenure-chart__toolbar">
        <div className="tenure-chart__sort">
          <label htmlFor={selectId}>Sort by</label>
          <select id={selectId} className="form-input" value={sortField} onChange={handleSort}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={`tenure-chart__card${sortCount > 0 ? ' tenure-chart--reordering' : ''}`}>
        {/* A horizontally scrolling region must be focusable so keyboard users can scroll it. */}
        <div
          className="tenure-chart__scroll"
          role="region"
          aria-label="Tenure timeline, scrollable"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <div className="tenure-chart__labels" aria-hidden="true" style={{ paddingTop: TOP }}>
            {bars.map((bar) => (
              <div
                key={bar.engineerId}
                className="tenure-chart__label"
                style={{ height: ROW_HEIGHT }}
              >
                <Avatar name={bar.name} size="sm" aria-hidden />
                <span className="truncate">{bar.name}</span>
              </div>
            ))}
          </div>
          <div className="tenure-chart__plot" style={{ width: svgWidth, height: svgHeight }}>
            <svg
              className="tenure-chart__svg"
              role="img"
              aria-label="Team tenure timeline chart"
              width={svgWidth}
              height={svgHeight}
            >
              <g aria-hidden="true">
                {timeScale.years.map((year) => {
                  const x = xOf(dayNumber(`${String(year).padStart(4, '0')}-01-01`));
                  return (
                    <g key={year}>
                      <line
                        className="tenure-chart__grid"
                        x1={x}
                        x2={x}
                        y1={TOP - 4}
                        y2={TOP + rowsHeight + 6}
                      />
                      <text className="tenure-chart__tick tnum" x={x + 4} y={TOP + rowsHeight + 22}>
                        {year}
                      </text>
                    </g>
                  );
                })}
                <line
                  className="tenure-chart__axis"
                  x1={0}
                  x2={plotWidth}
                  y1={TOP + rowsHeight + 6}
                  y2={TOP + rowsHeight + 6}
                />
              </g>
              <g aria-hidden="true">
                {bars.map((bar, index) => {
                  const { x, width, rowTop } = place(bar, index);
                  const y = rowTop + (ROW_HEIGHT - BAR_HEIGHT) / 2;
                  return (
                    <g
                      key={`${sortCount}-${bar.engineerId}`}
                      className={`tenure-bar tenure-bar--${bar.status.replace('_', '-')}`}
                      data-testid="tenure-bar"
                      data-status={bar.status}
                      style={{ '--bar-index': index } as CSSProperties}
                      onMouseEnter={() => setActiveId(bar.engineerId)}
                      onMouseLeave={() => setActiveId(null)}
                    >
                      <rect
                        className="tenure-bar__rect"
                        x={x}
                        y={y}
                        width={width}
                        height={BAR_HEIGHT}
                        rx={4}
                        ry={4}
                        strokeDasharray={bar.status === 'new_hire' ? '4 3' : undefined}
                      />
                      {bar.status === 'departing' ? (
                        <line
                          className="tenure-bar__cap"
                          data-testid="tenure-end-cap"
                          x1={x + width}
                          x2={x + width}
                          y1={y - 4}
                          y2={y + BAR_HEIGHT + 4}
                        />
                      ) : null}
                    </g>
                  );
                })}
              </g>
              <g aria-hidden="true" data-testid="tenure-today-marker">
                <line
                  className="tenure-chart__today"
                  x1={todayX}
                  x2={todayX}
                  y1={TOP - 6}
                  y2={TOP + rowsHeight + 6}
                />
                <text
                  className="tenure-chart__today-label"
                  x={todayX}
                  y={TOP - 12}
                  textAnchor={todayX > plotWidth - 40 ? 'end' : 'middle'}
                >
                  Today
                </text>
              </g>
            </svg>
            {activeBar && activePlacement ? (
              <div
                className="tenure-tooltip"
                role="tooltip"
                style={{
                  left: Math.min(
                    Math.max(activePlacement.x + activePlacement.width / 2, TOOLTIP_HALF_WIDTH),
                    Math.max(TOOLTIP_HALF_WIDTH, svgWidth - TOOLTIP_HALF_WIDTH),
                  ),
                  top: activePlacement.rowTop + (ROW_HEIGHT - BAR_HEIGHT) / 2,
                }}
              >
                {tooltipText(activeBar)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <TenureTable bars={bars} />
    </section>
  );
}

function tooltipText(bar: TenureBar): string {
  const start = `Start: ${formatMonthYear(bar.startDate)}`;
  const summary = bar.startsInFuture
    ? `${bar.name} — not started yet (${start})`
    : `${bar.name} — ${formatTenureShort(bar.tenureMonths)} (${start})`;
  return `${summary} · ${tenureStatusLabel(bar.status)}`;
}

function endDateText(bar: TenureBar): string {
  if (bar.status !== 'departing') return 'Present';
  return bar.departureUnknown ? 'Not set' : (formatStartDate(bar.endDate) ?? 'Not set');
}

/** The chart's text alternative. It carries every figure the bars show, plus the status in words. */
function TenureTable({ bars }: { bars: TenureBar[] }) {
  return (
    <table className="sr-only">
      <caption>Team tenure by person</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Start Date</th>
          <th scope="col">End Date</th>
          <th scope="col">Status</th>
          <th scope="col">Tenure</th>
        </tr>
      </thead>
      <tbody>
        {bars.map((bar) => (
          <tr key={bar.engineerId}>
            <th scope="row">{bar.name}</th>
            <td>{formatStartDate(bar.startDate) ?? bar.startDate}</td>
            <td>{endDateText(bar)}</td>
            <td>{tenureStatusLabel(bar.status)}</td>
            <td>{bar.startsInFuture ? 'Not started' : bar.tenureLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

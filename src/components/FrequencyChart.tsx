import { useState, type CSSProperties } from 'react';
import type { WeeklyFrequency } from '../types/meeting';
import { parseIsoDate } from '../utils/scheduleCalculator';
import '../styles/meeting-stats.css';

interface FrequencyChartProps {
  /** Twelve weeks, oldest first. */
  weeks: WeeklyFrequency[];
}

const PLOT_LEFT = 7;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 82;
const LABEL_Y = 95;
const BAR_SHARE = 0.6;
const BASELINE_PX = 2;

const weekOf = (weekStart: string) =>
  parseIsoDate(weekStart)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ??
  weekStart;
const meetings = (count: number) => `${count} ${count === 1 ? 'meeting' : 'meetings'}`;

/**
 * Bars are drawn by React state and percentages so they follow the container's width. Only week
 * granularity is shown, and the same figures are in a table for assistive technology.
 */
export function FrequencyChart({ weeks }: FrequencyChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // A chart of zeros still needs a scale, so the axis never divides by zero.
  const max = Math.max(1, ...weeks.map((week) => week.count));
  const slot = (100 - PLOT_LEFT) / Math.max(1, weeks.length);
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;
  const slotCenter = (index: number) => PLOT_LEFT + slot * index + slot / 2;
  const barTop = (count: number) => PLOT_BOTTOM - (count / max) * plotHeight;
  const active = activeIndex === null ? null : weeks[activeIndex];

  return (
    <div className="frequency-chart">
      <div className="frequency-chart__plot">
        <svg
          className="frequency-chart__svg"
          role="img"
          aria-label="Meeting frequency: last 12 weeks"
        >
          <line
            className="frequency-chart__grid"
            x1={`${PLOT_LEFT}%`}
            x2="100%"
            y1={`${PLOT_TOP}%`}
            y2={`${PLOT_TOP}%`}
          />
          <line
            className="frequency-chart__axis"
            x1={`${PLOT_LEFT}%`}
            x2="100%"
            y1={`${PLOT_BOTTOM}%`}
            y2={`${PLOT_BOTTOM}%`}
          />
          <text
            className="frequency-chart__tick frequency-chart__tick--y"
            x={`${PLOT_LEFT - 2}%`}
            y={`${PLOT_TOP}%`}
          >
            {max}
          </text>
          <text
            className="frequency-chart__tick frequency-chart__tick--y"
            x={`${PLOT_LEFT - 2}%`}
            y={`${PLOT_BOTTOM}%`}
          >
            0
          </text>
          {weeks.map((week, index) => {
            const x = PLOT_LEFT + slot * index + (slot * (1 - BAR_SHARE)) / 2;
            return (
              <g key={week.weekStart}>
                <text
                  className="frequency-chart__tick frequency-chart__tick--x"
                  x={`${slotCenter(index)}%`}
                  y={`${LABEL_Y}%`}
                >
                  {week.weekLabel}
                </text>
                <g
                  aria-hidden="true"
                  data-testid="frequency-bar"
                  data-count={week.count}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <rect
                    className="frequency-chart__hit"
                    x={`${PLOT_LEFT + slot * index}%`}
                    y="0"
                    width={`${slot}%`}
                    height={`${PLOT_BOTTOM}%`}
                  />
                  {week.count === 0 ? (
                    <rect
                      className="frequency-chart__baseline"
                      x={`${x}%`}
                      y={`${PLOT_BOTTOM}%`}
                      width={`${slot * BAR_SHARE}%`}
                      height={BASELINE_PX}
                    />
                  ) : (
                    <g className="chart-bar" style={{ '--bar-index': index } as CSSProperties}>
                      {/* The nested viewport clips the oversized rect, leaving only the top corners rounded. */}
                      <svg
                        x={`${x}%`}
                        y={`${barTop(week.count)}%`}
                        width={`${slot * BAR_SHARE}%`}
                        height={`${PLOT_BOTTOM - barTop(week.count)}%`}
                      >
                        <rect
                          className="frequency-chart__bar"
                          width="100%"
                          height="200%"
                          rx="4"
                          ry="4"
                        />
                      </svg>
                    </g>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
        {active && activeIndex !== null ? (
          <div
            className="chart-tooltip"
            role="tooltip"
            style={{
              left: `${Math.min(88, Math.max(12, slotCenter(activeIndex)))}%`,
              top: `${barTop(active.count)}%`,
            }}
          >
            Week of {weekOf(active.weekStart)}: {meetings(active.count)}
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>Meetings per week, last 12 weeks</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Meetings</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <td>Week of {weekOf(week.weekStart)}</td>
              <td>{week.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

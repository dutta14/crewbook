import { useState } from 'react';
import type { MoodEntry } from '../types/MoodEntry';
import { MOOD_LABELS } from '../utils/moodScale';
import '../styles/mood.css';

interface MoodTrendChartProps {
  /** Pre-sorted chronologically. Only the most recent MAX_POINTS are drawn. */
  entries: MoodEntry[];
}

export const MAX_POINTS = 12;

const EDGE_PERCENT = 8;
const TOP_PERCENT = 10;
const ROW_PERCENT = 17.5;
const LABEL_Y_PERCENT = 94;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const xPercent = (index: number, count: number) =>
  count === 1 ? 50 : EDGE_PERCENT + (index * (100 - 2 * EDGE_PERCENT)) / (count - 1);
const yPercent = (score: number) => TOP_PERCENT + (5 - score) * ROW_PERCENT;

/** Every 2nd or 3rd date is labelled once the points would otherwise crowd each other. */
const labelStep = (count: number) => (count <= 4 ? 1 : count <= 8 ? 2 : 3);

export function MoodTrendChart({ entries }: MoodTrendChartProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const points = entries.slice(-MAX_POINTS);
  if (points.length === 0) return <p className="mood-chart__empty">No mood data recorded yet</p>;

  const plotted = points.map((entry, index) => ({
    entry,
    x: xPercent(index, points.length),
    y: yPercent(entry.score),
  }));
  const active = plotted.find(({ entry }) => entry.id === activeId) ?? null;
  const step = labelStep(points.length);

  return (
    <div className="mood-chart">
      <div className="mood-chart__plot">
        <svg
          className="mood-chart__svg"
          role="img"
          aria-label={`Energy trend over last ${points.length} ${points.length === 1 ? 'session' : 'sessions'}`}
        >
          {[1, 2, 3, 4, 5].map((score) => (
            <line
              key={score}
              className="mood-chart__grid"
              x1="0"
              x2="100%"
              y1={`${yPercent(score)}%`}
              y2={`${yPercent(score)}%`}
            />
          ))}
          {plotted.length > 1 ? (
            <svg className="mood-chart__line-layer" width="100%" height="100%">
              {plotted.slice(1).map(({ entry, x, y }, index) => (
                <line
                  key={entry.id}
                  className="mood-chart__line"
                  x1={`${plotted[index].x}%`}
                  y1={`${plotted[index].y}%`}
                  x2={`${x}%`}
                  y2={`${y}%`}
                />
              ))}
            </svg>
          ) : null}
          {plotted.map(({ entry, x, y }, index) => (
            <g key={entry.id}>
              {index % step === 0 ? (
                <text className="mood-chart__label" x={`${x}%`} y={`${LABEL_Y_PERCENT}%`}>
                  {shortDate(entry.recordedAt)}
                </text>
              ) : null}
              <g
                className="mood-chart__dot-group"
                aria-hidden="true"
                data-testid="mood-dot"
                onMouseEnter={() => setActiveId(entry.id)}
                onMouseLeave={() => setActiveId(null)}
              >
                <circle className="mood-chart__hit" cx={`${x}%`} cy={`${y}%`} r="12" />
                <circle className="mood-chart__dot" cx={`${x}%`} cy={`${y}%`} r="4" />
              </g>
            </g>
          ))}
        </svg>
        {active ? (
          <div
            className="mood-chart__tooltip"
            role="tooltip"
            style={{ left: `${active.x}%`, top: `${active.y}%` }}
          >
            {longDate(active.entry.recordedAt)}{' '}
            <span aria-hidden="true">{MOOD_LABELS[active.entry.score].emoji}</span>
            <span className="sr-only">{MOOD_LABELS[active.entry.score].label}</span>
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>Energy by 1:1 date</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Mood</th>
          </tr>
        </thead>
        <tbody>
          {points.map((entry) => (
            <tr key={entry.id}>
              <td>{longDate(entry.recordedAt)}</td>
              <td>{MOOD_LABELS[entry.score].label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

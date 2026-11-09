import { useId } from 'react';
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS } from '../data/feedbackStore';
import type { FeedbackType } from '../types/feedback';
import type { TeamMember } from '../types/TeamMember';
import { toIsoDate } from '../utils/scheduleCalculator';
import '../styles/form.css';
import '../styles/feedback.css';
import { SearchIcon } from './icons';

export interface FeedbackFilterValues {
  engineerId: string;
  type: '' | FeedbackType;
  tag: string;
  start: string;
  end: string;
  search: string;
}

export const EMPTY_FILTER_VALUES: FeedbackFilterValues = {
  engineerId: '',
  type: '',
  tag: '',
  start: '',
  end: '',
  search: '',
};

interface FeedbackFiltersProps {
  values: FeedbackFilterValues;
  onChange: (values: FeedbackFilterValues) => void;
  members: Pick<TeamMember, 'id' | 'name'>[];
  tags: string[];
  /** Hidden when the log is already about one person. */
  showPerson: boolean;
}

/** Number of filters narrowing the list. The person counts only when it can be changed here. */
export function countActiveFilters(values: FeedbackFilterValues, showPerson: boolean): number {
  return [
    showPerson && values.engineerId !== '',
    values.type !== '',
    values.tag !== '',
    values.start !== '' || values.end !== '',
    values.search.trim() !== '',
  ].filter(Boolean).length;
}

export function FeedbackFilters({
  values,
  onChange,
  members,
  tags,
  showPerson,
}: FeedbackFiltersProps) {
  const prefix = useId();
  const today = toIsoDate(new Date());
  const active = countActiveFilters(values, showPerson);
  const set = <K extends keyof FeedbackFilterValues>(key: K, value: FeedbackFilterValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="feedback-filters" role="group" aria-label="Filter feedback">
      <div className="feedback-filters__search">
        <SearchIcon size={16} />
        <input
          type="search"
          className="form-input"
          aria-label="Search feedback"
          placeholder="Search feedback"
          autoComplete="off"
          value={values.search}
          onChange={(event) => set('search', event.target.value)}
        />
      </div>
      {showPerson ? (
        <div className="feedback-filters__field">
          <label className="form-label" htmlFor={`${prefix}-person`}>
            Person
          </label>
          <select
            id={`${prefix}-person`}
            className="form-input"
            value={values.engineerId}
            onChange={(event) => set('engineerId', event.target.value)}
          >
            <option value="">Everyone</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="feedback-filters__field">
        <label className="form-label" htmlFor={`${prefix}-type`}>
          Type
        </label>
        <select
          id={`${prefix}-type`}
          className="form-input"
          value={values.type}
          onChange={(event) => {
            const { value } = event.target;
            set(
              'type',
              (FEEDBACK_TYPES as readonly string[]).includes(value) ? (value as FeedbackType) : '',
            );
          }}
        >
          <option value="">All types</option>
          {FEEDBACK_TYPES.map((type) => (
            <option key={type} value={type}>
              {FEEDBACK_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="feedback-filters__field">
        <label className="form-label" htmlFor={`${prefix}-tag`}>
          Tag
        </label>
        <select
          id={`${prefix}-tag`}
          className="form-input"
          value={values.tag}
          onChange={(event) => set('tag', event.target.value)}
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>
      <div className="feedback-filters__field">
        <label className="form-label" htmlFor={`${prefix}-from`}>
          From
        </label>
        <input
          id={`${prefix}-from`}
          type="date"
          className="form-input"
          max={values.end || today}
          value={values.start}
          onChange={(event) => set('start', event.target.value)}
        />
      </div>
      <div className="feedback-filters__field">
        <label className="form-label" htmlFor={`${prefix}-to`}>
          To
        </label>
        <input
          id={`${prefix}-to`}
          type="date"
          className="form-input"
          min={values.start || undefined}
          max={today}
          value={values.end}
          onChange={(event) => set('end', event.target.value)}
        />
      </div>
      {active > 0 ? (
        <div className="feedback-filters__summary">
          <span
            className="feedback-filters__count"
            role="img"
            aria-label={`${active} active filters`}
          >
            {active}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onChange(EMPTY_FILTER_VALUES)}
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { TeamMember } from '../types';
import '../styles/form.css';
import '../styles/connections.css';

interface PeerComboboxProps {
  id: string;
  /** What is typed in the box. */
  value: string;
  /** Candidates from the team; the caller leaves out anyone who can't be picked. */
  members: readonly TeamMember[];
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** A team member picks `peerId`; anything typed is free text and has `peerId` null. */
  onChange: (value: string, peerId: string | null) => void;
}

type Option =
  | { kind: 'member'; key: string; label: string; member: TeamMember }
  | { kind: 'cross-team'; key: string; label: string };

/** Typing narrows the team list; a name that isn't on it can be kept as a cross-team peer. */
export function PeerCombobox({
  id,
  value,
  members,
  disabled = false,
  invalid = false,
  describedBy,
  onChange,
}: PeerComboboxProps) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const options = useMemo<Option[]>(() => {
    const query = value.trim().toLowerCase();
    const matches: Option[] = members
      .filter((member) => member.name.toLowerCase().includes(query))
      .map((member) => ({ kind: 'member', key: member.id, label: member.name, member }));
    const hasExact = members.some((member) => member.name.toLowerCase() === query);
    if (query !== '' && !hasExact) {
      matches.push({
        kind: 'cross-team',
        key: 'cross-team',
        label: `Add "${value.trim()}" as cross-team peer`,
      });
    }
    return matches;
  }, [members, value]);

  const showList = isOpen && options.length > 0 && !disabled;
  const optionId = (index: number) => `${listId}-option-${index}`;

  const choose = (option: Option) => {
    if (option.kind === 'member') onChange(option.member.name, option.member.id);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (options.length === 0) return;
      event.preventDefault();
      setIsOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
    } else if (event.key === 'Enter' && showList && activeIndex >= 0) {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === 'Escape' && showList) {
      // Closes the list only; the dialog around it stays open.
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const resultCount = options.filter((option) => option.kind === 'member').length;
  const status = showList ? `${resultCount} ${resultCount === 1 ? 'result' : 'results'}` : '';

  return (
    <div className="peer-combobox">
      <input
        id={id}
        type="text"
        role="combobox"
        className="form-input"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-required="true"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        maxLength={100}
        disabled={disabled}
        value={value}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setIsOpen(false);
          setActiveIndex(-1);
        }}
        onChange={(event) => {
          onChange(event.target.value, null);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {showList ? (
        <ul id={listId} role="listbox" aria-label="Team members" className="peer-combobox__list">
          {options.map((option, index) => (
            // Options are chosen with the pointer here; the keyboard drives them from the input.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={option.key}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={`peer-combobox__option${
                option.kind === 'cross-team' ? ' peer-combobox__option--cross-team' : ''
              }`}
              // Keeps focus in the input so choosing an option doesn't blur and close first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

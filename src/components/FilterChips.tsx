import { useRef, type KeyboardEvent } from 'react';
import './FilterChips.css';

interface FilterChipsProps {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export function FilterChips({ options, value, onChange, ariaLabel }: FilterChipsProps) {
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  // With no valid selection the group still needs one tab stop.
  const tabStopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    chipRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    let target: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        target = index === 0 ? last : index - 1;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(target);
  };

  return (
    <div className="filter-chips" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              chipRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={index === tabStopIndex ? 0 : -1}
            className={`filter-chip${isSelected ? ' filter-chip--selected' : ''}`}
            onClick={() => select(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

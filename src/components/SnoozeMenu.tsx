import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { SnoozeOption } from '../types/reminder';
import { SNOOZE_LABELS } from '../utils/reminderFormat';
import '../styles/button.css';
import '../styles/reminder.css';
import { ChevronDownIcon } from './icons';

const OPTIONS: readonly SnoozeOption[] = ['1_day', '1_week', 'next_1on1'];

interface SnoozeMenuProps {
  onSelect: (option: SnoozeOption) => void;
  disabled?: boolean;
}

/** A transient menu: it is only in the DOM while open, and closes on Escape, Tab or a click away. */
export function SnoozeMenu({ onSelect, disabled = false }: SnoozeMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) itemRefs.current[0]?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const focusItem = (index: number) => {
    const last = OPTIONS.length - 1;
    itemRefs.current[index < 0 ? last : index > last ? 0 : index]?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.findIndex((item) => item === document.activeElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(current + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(OPTIONS.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
    }
  };

  return (
    <div
      ref={rootRef}
      className="snooze-menu-root"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (isOpen && next instanceof Node && !event.currentTarget.contains(next)) setIsOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost reminder-card__action"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        Snooze
        <ChevronDownIcon size={14} />
      </button>
      {isOpen ? (
        // The menu role owns arrow-key navigation for its items.
        // eslint-disable-next-line jsx-a11y/interactive-supports-focus
        <div
          id={menuId}
          className="snooze-menu"
          role="menu"
          aria-label="Snooze for"
          onKeyDown={handleMenuKeyDown}
        >
          {OPTIONS.map((option, index) => (
            <button
              key={option}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="snooze-menu__item"
              onClick={() => {
                setIsOpen(false);
                onSelect(option);
              }}
            >
              {SNOOZE_LABELS[option]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

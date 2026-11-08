import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { MoreVerticalIcon } from './icons';

export interface OverflowMenuItem {
  label: string;
  onSelect: () => void;
}

interface OverflowMenuProps {
  /** Names the trigger. Keep it generic so nothing sensitive is announced. */
  label: string;
  items: OverflowMenuItem[];
}

export function OverflowMenu({ label, items }: OverflowMenuProps) {
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
    const last = items.length - 1;
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
        focusItem(items.length - 1);
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

  const select = (item: OverflowMenuItem) => {
    // Focus goes back to the trigger first, so a dialog opened by the item returns focus to it.
    close();
    item.onSelect();
  };

  return (
    <div ref={rootRef} className="overflow-menu">
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <MoreVerticalIcon />
      </button>
      {isOpen ? (
        // The menu role owns arrow-key navigation for its items.
        // eslint-disable-next-line jsx-a11y/interactive-supports-focus
        <div
          id={menuId}
          className="overflow-menu__list"
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="overflow-menu__item"
              onClick={() => select(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

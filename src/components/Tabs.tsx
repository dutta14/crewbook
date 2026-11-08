import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import './Tabs.css';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  defaultActiveId?: string;
  /** Makes the active tab controlled, so the page can open a tab such as a linked note's. */
  activeId?: string;
  onActiveChange?: (id: string) => void;
  ariaLabel?: string;
}

export function Tabs({ tabs, defaultActiveId, activeId, onActiveChange, ariaLabel }: TabsProps) {
  const prefix = useId();
  const [internalId, setInternalId] = useState(defaultActiveId ?? tabs[0]?.id);
  const currentId = activeId ?? internalId;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const active = tabs.some((tab) => tab.id === currentId) ? currentId : tabs[0]?.id;

  useLayoutEffect(() => {
    const element = active ? tabRefs.current.get(active) : undefined;
    if (element) setIndicator({ left: element.offsetLeft, width: element.offsetWidth });
  }, [active, tabs]);

  const select = (id: string, focus: boolean) => {
    setInternalId(id);
    onActiveChange?.(id);
    if (focus) tabRefs.current.get(id)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(tabs[target].id, true);
  };

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) tabRefs.current.set(tab.id, element);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${prefix}-tab-${tab.id}`}
            className="tabs__tab"
            aria-selected={tab.id === active}
            aria-controls={`${prefix}-panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            onClick={() => select(tab.id, false)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
        <span
          className="tabs__indicator"
          aria-hidden="true"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>
      {/* Every panel stays mounted so switching tabs never discards its state. */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${prefix}-panel-${tab.id}`}
          className="tabs__panel"
          aria-labelledby={`${prefix}-tab-${tab.id}`}
          tabIndex={tab.id === active ? 0 : undefined}
          hidden={tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

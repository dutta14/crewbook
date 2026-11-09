import { useId, useRef } from 'react';
import { useAgendaItems } from '../hooks/useAgendaItems';
import '../styles/agenda.css';
import { AgendaItemInput } from './AgendaItemInput';
import { AgendaLiveItem } from './AgendaLiveItem';
import { AgendaPrepItem } from './AgendaPrepItem';

interface AgendaSectionProps {
  memberId: string;
  /** Names the engineer in the prep card; the live checklist does not show who added a topic. */
  memberName?: string;
  /** Prep is the card on the profile, with adding and removing. Live is a checklist for the meeting. */
  mode: 'prep' | 'live';
}

/** The topics for the next 1:1, in the manager's own app. The engineer's copy is a read-only snapshot. */
export function AgendaSection({ memberId, memberName = 'Engineer', mode }: AgendaSectionProps) {
  const { items, addItem, deleteItem, toggleDiscussed, setIncludeInShare } =
    useAgendaItems(memberId);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isPrep = mode === 'prep';

  const handleDelete = (id: string) => {
    // The remove button goes with the item, so focus moves somewhere that stays.
    headingRef.current?.focus();
    deleteItem(id).catch(() => undefined);
  };

  return (
    <section
      className={`agenda agenda--${mode}`}
      aria-labelledby={headingId}
      data-testid={`agenda-${mode}`}
    >
      <h3 id={headingId} ref={headingRef} tabIndex={-1} className="agenda__title">
        {isPrep ? "Engineer's Agenda" : 'Agenda'}
      </h3>
      {items.length === 0 ? (
        <p className="agenda__empty">
          {isPrep ? 'No agenda items yet. Add one below.' : 'No agenda items for this 1:1.'}
        </p>
      ) : (
        <ul className="agenda__list" aria-label="Agenda items">
          {items.map((item) =>
            isPrep ? (
              <AgendaPrepItem
                key={item.id}
                item={item}
                memberName={memberName}
                onDelete={handleDelete}
                onShareChange={(id, include) =>
                  void setIncludeInShare(id, include).catch(() => undefined)
                }
              />
            ) : (
              <AgendaLiveItem
                key={item.id}
                item={item}
                onToggle={(id) => void toggleDiscussed(id).catch(() => undefined)}
              />
            ),
          )}
        </ul>
      )}
      {isPrep ? <AgendaItemInput memberName={memberName} onAdd={addItem} /> : null}
    </section>
  );
}

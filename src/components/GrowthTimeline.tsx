import { useId, useRef, useState } from 'react';
import { useGrowthEntries } from '../hooks/useGrowthEntries';
import { useToast } from '../hooks/useToast';
import type { TeamMember } from '../types/TeamMember';
import type { GrowthEntry } from '../types/growth';
import { copyWithAutoClear } from '../utils/clipboard';
import '../styles/button.css';
import '../styles/growth.css';
import { EmptyState } from './EmptyState';
import { GrowthEntryItem } from './GrowthEntryItem';
import { GrowthEntryModal } from './GrowthEntryModal';
import { TrendingUpIcon } from './icons';

const EXPORT_TOAST_MS = 4000;

interface GrowthTimelineProps {
  member: Pick<TeamMember, 'id' | 'name' | 'role' | 'level'>;
}

/** The entry being edited stays set while the dialog animates out, so it never flashes empty. */
interface ModalState {
  isOpen: boolean;
  entry?: GrowthEntry;
}

export function GrowthTimeline({ member }: GrowthTimelineProps) {
  const { entries, currentLevel, addEntry, updateEntry, deleteEntry, exportAsText } =
    useGrowthEntries(member.id);
  const { showToast } = useToast();
  const [modal, setModal] = useState<ModalState>({ isOpen: false });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const openAdd = () => setModal({ isOpen: true });
  const openEdit = (entry: GrowthEntry) => setModal({ isOpen: true, entry });
  const closeModal = () => setModal((current) => ({ ...current, isOpen: false }));

  const handleExport = async () => {
    try {
      await copyWithAutoClear(exportAsText());
      // Deliberately no excerpt: the toast may be on a shared screen.
      showToast('Copied to clipboard', 'success', EXPORT_TOAST_MS);
    } catch {
      showToast('Copy failed. Try again.', 'error');
    }
  };

  const handleDelete = async () => {
    const id = modal.entry?.id;
    if (!id) return;
    await deleteEntry(id);
    // The edit button that opened the dialog is gone, so focus would otherwise be lost.
    headingRef.current?.focus();
  };

  const levelText = currentLevel ?? `${member.level} · ${member.role}`;

  return (
    <section className="growth" aria-labelledby={headingId}>
      <div className="growth__header">
        <h2 id={headingId} ref={headingRef} className="growth__title" tabIndex={-1}>
          Growth
        </h2>
        {entries.length > 0 ? (
          <div className="growth__actions">
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Export growth history as text"
              onClick={() => void handleExport()}
            >
              Export
            </button>
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              Add entry
            </button>
          </div>
        ) : null}
      </div>
      <div className="growth__current">
        <span className="growth__current-label">Current level / role</span>
        <span className="growth__current-value">{levelText}</span>
      </div>
      {entries.length === 0 ? (
        <EmptyState
          icon={<TrendingUpIcon size={48} />}
          title="No growth entries yet"
          action={{ label: 'Add first entry', onClick: openAdd }}
        />
      ) : (
        <ol className="growth-timeline" aria-label="Growth timeline">
          {entries.map((entry) => (
            <GrowthEntryItem key={entry.id} entry={entry} onEdit={openEdit} />
          ))}
        </ol>
      )}
      <GrowthEntryModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        entry={modal.entry}
        onSubmit={async (values) => {
          if (modal.entry) await updateEntry(modal.entry.id, values);
          else await addEntry(values);
        }}
        onDelete={modal.entry ? handleDelete : undefined}
      />
    </section>
  );
}

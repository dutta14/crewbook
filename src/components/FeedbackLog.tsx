import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { listMembers } from '../data/members';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useFeedback } from '../hooks/useFeedback';
import { useToast } from '../hooks/useToast';
import type { FeedbackEntry, FeedbackFilter } from '../types/feedback';
import { describeFeedbackCount } from '../utils/feedbackFormat';
import '../styles/button.css';
import '../styles/feedback.css';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { FeedbackEntryCard } from './FeedbackEntryCard';
import { EMPTY_FILTER_VALUES, FeedbackFilters, type FeedbackFilterValues } from './FeedbackFilters';
import { FeedbackModal } from './FeedbackModal';
import { MessageSquareIcon, PlusIcon } from './icons';
import { PromoPacketMode } from './PromoPacketMode';

const SEARCH_DEBOUNCE_MS = 250;

interface FeedbackLogProps {
  /** Limits the log to one person: the person filter is hidden and new entries default to them. */
  engineerId?: string;
  headingLevel?: 1 | 2;
  /** Moves focus to the heading when the log appears, for when it is the whole page. */
  focusHeadingOnMount?: boolean;
}

/** The entry being edited stays set while the dialog animates out, so it never flashes empty. */
interface ModalState {
  isOpen: boolean;
  entry?: FeedbackEntry;
}

/**
 * Filter state lives in memory only: no URL, no storage. What was searched for (a person's name,
 * a word from an observation) is not left behind in history or a bookmark.
 */
export function FeedbackLog({
  engineerId,
  headingLevel = 2,
  focusHeadingOnMount = false,
}: FeedbackLogProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [values, setValues] = useState<FeedbackFilterValues>(EMPTY_FILTER_VALUES);
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>({ isOpen: false });
  const [pendingDelete, setPendingDelete] = useState<FeedbackEntry | null>(null);
  const search = useDebouncedValue(values.search, SEARCH_DEBOUNCE_MS);
  const members = useMemo(() => listMembers(storage), [storage]);
  const nameById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  useEffect(() => {
    if (focusHeadingOnMount) headingRef.current?.focus();
  }, [focusHeadingOnMount]);

  const filter = useMemo<FeedbackFilter>(
    () => ({
      engineerId: engineerId ?? (values.engineerId || undefined),
      type: values.type || undefined,
      tag: values.tag || undefined,
      dateRange: { start: values.start || undefined, end: values.end || undefined },
      search,
    }),
    [engineerId, values, search],
  );
  const {
    entries,
    totalCount,
    countForEngineer,
    availableTags,
    addEntry,
    updateEntry,
    deleteEntry,
    exportPromoPacket,
  } = useFeedback(filter);
  const scopedTotal = engineerId ? countForEngineer(engineerId) : totalCount;
  const hasFilters =
    values.type !== '' ||
    values.tag !== '' ||
    values.start !== '' ||
    values.end !== '' ||
    values.search.trim() !== '' ||
    (!engineerId && values.engineerId !== '');

  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const openAdd = () => setModal({ isOpen: true });
  const closeModal = () => setModal((current) => ({ ...current, isOpen: false }));

  const handleConfirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await deleteEntry(target.id);
      showToast('Feedback deleted', 'success');
      // The delete button that opened the dialog is gone, so focus would otherwise be lost.
      headingRef.current?.focus();
    } catch {
      // The failure has already been reported with a toast; the entry stays as it was.
    }
  };

  const unknownMember = { name: 'Former team member', avatarUrl: undefined };

  return (
    <section className="feedback-log" aria-labelledby={headingId}>
      <div className="feedback-log__header">
        <Heading id={headingId} ref={headingRef} className="feedback-log__title" tabIndex={-1}>
          Feedback
        </Heading>
        <div className="feedback-log__actions">
          <button
            type="button"
            className="btn btn-secondary"
            aria-pressed={isPromoOpen}
            onClick={() => setIsPromoOpen((open) => !open)}
          >
            Promo packet mode
          </button>
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <PlusIcon size={16} />
            Log feedback
          </button>
        </div>
      </div>
      <p className="feedback-log__privacy">
        <span aria-hidden="true">🔒</span> Only you can see feedback. It is never part of anything
        you share.
      </p>
      {isPromoOpen ? (
        <PromoPacketMode
          members={members}
          lockedEngineerId={engineerId}
          exportPromoPacket={exportPromoPacket}
        />
      ) : null}
      {scopedTotal > 0 ? (
        <FeedbackFilters
          values={values}
          onChange={setValues}
          members={members}
          tags={availableTags}
          showPerson={!engineerId}
        />
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {scopedTotal > 0 ? `${describeFeedbackCount(entries.length)} shown` : ''}
      </p>
      {scopedTotal === 0 ? (
        <EmptyState
          icon={<MessageSquareIcon size={48} />}
          title="No feedback logged yet"
          description="Write down what you see while it's fresh. It adds up to a clear picture at review time."
          action={{ label: 'Log your first observation', onClick: openAdd }}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<MessageSquareIcon size={48} />}
          title="No matching feedback"
          description={
            hasFilters ? 'Try a different search or clear the filters.' : 'Nothing to show.'
          }
          secondaryAction={
            hasFilters
              ? { label: 'Clear filters', onClick: () => setValues(EMPTY_FILTER_VALUES) }
              : undefined
          }
        />
      ) : (
        <ul className="feedback-list" aria-label="Feedback entries">
          {entries.map((entry) => {
            const person = nameById.get(entry.engineerId) ?? unknownMember;
            return (
              <FeedbackEntryCard
                key={entry.id}
                entry={entry}
                personName={person.name}
                avatarUrl={person.avatarUrl}
                onEdit={(target) => setModal({ isOpen: true, entry: target })}
                onDelete={setPendingDelete}
              />
            );
          })}
        </ul>
      )}
      <FeedbackModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        members={members}
        defaultEngineerId={engineerId}
        entry={modal.entry}
        onSubmit={async (input) => {
          if (modal.entry) {
            await updateEntry(modal.entry.id, input);
            showToast('Feedback updated', 'success');
          } else {
            await addEntry(input);
            showToast('Feedback logged', 'success');
          }
        }}
      />
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete this feedback?"
        message="This removes the observation for good. This can't be undone."
        confirmLabel="Delete"
      />
    </section>
  );
}

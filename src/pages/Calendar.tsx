import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarGrid } from '../components/CalendarGrid';
import type { CalendarView } from '../components/CalendarToolbar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { CalendarIcon } from '../components/icons';
import { LeaveForm } from '../components/LeaveForm';
import { listMembers } from '../data/members';
import { getFirstDayOfWeek } from '../data/settings';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useLeave } from '../hooks/useLeave';
import { usePrivateEnvelope } from '../hooks/usePrivateEnvelope';
import { useToast } from '../hooks/useToast';
import type { LeaveEntry } from '../types/leave';
import { toIsoDate } from '../utils/scheduleCalculator';
import '../styles/button.css';
import '../styles/calendar.css';
import '../styles/form.css';

const LOAD_FAILED = "Couldn't open your calendar. Lock and unlock Crewbook to try again.";

/** Leave types can be about health or family, so the calendar waits for the private envelope. */
export function Calendar() {
  const { isReady, loadFailed } = usePrivateEnvelope();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="calendar-page__title">
        PTO Calendar
      </h1>
      {loadFailed ? (
        <p className="form-error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : isReady ? (
        <CalendarContent />
      ) : (
        <p className="calendar-page__loading">Opening your calendar…</p>
      )}
    </>
  );
}

function CalendarContent() {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const { entries, createLeave, updateLeave, deleteLeave } = useLeave();
  const members = useMemo(() => listMembers(storage), [storage]);
  const [today] = useState(() => toIsoDate(new Date()));
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(today);
  // The entry being edited is kept while the form animates out, so the title does not flip.
  const [form, setForm] = useState<{ isOpen: boolean; entry?: LeaveEntry }>({ isOpen: false });
  const [deleting, setDeleting] = useState<LeaveEntry | null>(null);
  const gridWrapRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (input: Parameters<typeof createLeave>[0]) => {
    if (form.entry) {
      await updateLeave(form.entry.id, input);
      showToast('Leave updated', 'success');
    } else {
      await createLeave(input);
      showToast('Leave added', 'success');
    }
  };

  const handleRequestDelete = (entry: LeaveEntry) => {
    setForm({ isOpen: false, entry });
    setDeleting(entry);
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    const { id } = deleting;
    setDeleting(null);
    deleteLeave(id).then(
      () => {
        showToast('Leave deleted', 'success');
        // The chip that held focus is gone, so focus would otherwise fall back to the page body.
        gridWrapRef.current?.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')?.focus();
      },
      () => undefined,
    );
  };

  const deletingPerson = members.find((member) => member.id === deleting?.memberId);

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon size={48} />}
        title="No one to schedule yet"
        description="Add people to your team and you can record their time off here."
      />
    );
  }

  return (
    <section className="calendar-page" aria-label="Leave calendar">
      <div className="calendar-page__actions">
        <button type="button" className="btn btn-primary" onClick={() => setForm({ isOpen: true })}>
          + Add leave
        </button>
      </div>
      <div ref={gridWrapRef}>
        <CalendarGrid
          view={view}
          onViewChange={setView}
          cursor={cursor}
          onCursorChange={setCursor}
          entries={entries}
          members={members}
          today={today}
          firstDay={getFirstDayOfWeek(storage)}
          onSelectEntry={(entry) => setForm({ isOpen: true, entry })}
        />
      </div>
      <LeaveForm
        isOpen={form.isOpen}
        onClose={() => setForm((current) => ({ ...current, isOpen: false }))}
        onSubmit={handleSubmit}
        members={members}
        entry={form.entry}
        defaultDate={cursor}
        onRequestDelete={handleRequestDelete}
      />
      <ConfirmDialog
        isOpen={deleting !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
        title="Delete leave?"
        message={`This removes ${deletingPerson?.name ?? 'this person'}'s leave from the calendar. This can't be undone.`}
        confirmLabel="Delete"
      />
    </section>
  );
}

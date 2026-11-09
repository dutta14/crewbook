import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AddMemberModal } from '../components/AddMemberModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ConnectionsPanel } from '../components/ConnectionsPanel';
import { DecisionsPanel } from '../components/DecisionsPanel';
import { EmptyState } from '../components/EmptyState';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { GrowthPanel } from '../components/GrowthPanel';
import { TeamIcon } from '../components/icons';
import { ActiveTokensList } from '../components/ActiveTokensList';
import { KeyDates } from '../components/KeyDates';
import { LiveMode } from '../components/LiveMode';
import { MeetingsPanel } from '../components/MeetingsPanel';
import { MoodPrompt } from '../components/MoodPrompt';
import { MoodTrendSection } from '../components/MoodTrendSection';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileOverview } from '../components/ProfileOverview';
import { NotesSection } from '../components/NotesSection';
import { AgendaSection } from '../components/AgendaSection';
import { PrepPrompts } from '../components/PrepPrompts';
import { PrivateNotes } from '../components/PrivateNotes';
import { ReminderForm } from '../components/ReminderForm';
import { ReminderList } from '../components/ReminderList';
import { ScheduleCard } from '../components/ScheduleCard';
import { ShareButton } from '../components/ShareButton';
import { SkillsPanel } from '../components/SkillsPanel';
import { Tabs } from '../components/Tabs';
import { Timeline } from '../components/Timeline';
import { deleteActionItemsForMember } from '../data/actionItems';
import { deleteConnectionsForMember } from '../data/connectionsStore';
import { deleteDecisionsForMember } from '../data/decisions';
import { deleteDateEventsForMember } from '../data/dateEvents';
import { deleteFeedbackForMember } from '../data/feedbackStore';
import { deleteGrowthForMember } from '../data/growthStore';
import { deleteLeaveForMember } from '../data/leave';
import { deleteMember, getMember, listMembers, updateMember } from '../data/members';
import { deleteMoodEntriesForMember } from '../data/moodEntries';
import { deleteAgendaForMember } from '../data/agenda';
import { deleteNotesForMember } from '../data/notes';
import { deletePrivateNotesForMember } from '../data/privateStore';
import { deleteRemindersForMember } from '../data/reminders';
import { deleteShareTokensForMember } from '../data/shareStore';
import { deleteSkillsForMember } from '../data/skillsStore';
import { deleteTodosForMember } from '../data/todos';
import { isMoodTrackingEnabled } from '../data/settings';
import { buildTimeline } from '../data/timeline';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useFeedbackCount } from '../hooks/useFeedbackCount';
import { useFeedbackQuickAdd } from '../hooks/useFeedbackQuickAdd';
import { useReminders } from '../hooks/useReminders';
import { useToast } from '../hooks/useToast';
import type { LiveSession } from '../types/LiveSession';
import type { Note } from '../types/Note';
import '../styles/profile.css';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decision and follow-up links name their note in router state, so its id stays out of the URL. */
function getStateNoteId(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('noteId' in state)) return null;
  return typeof state.noteId === 'string' ? state.noteId : null;
}

export function Profile() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { key: locationKey, state: locationState } = useLocation();
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [rateNoteId, setRateNoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const { createReminder } = useReminders({ personId: id });
  const { openQuickAdd, quickAddModal } = useFeedbackQuickAdd();
  const feedbackCount = useFeedbackCount(id);
  const members = useMemo(() => listMembers(storage), [storage]);
  // Anything that is not a UUID is rejected before it reaches the store.
  const member = useMemo(
    () => (UUID_PATTERN.test(id) ? getMember(id, storage) : null),
    [id, storage],
  );
  const manager = member?.manager ? (members.find((m) => m.id === member.manager) ?? null) : null;
  const timeline = useMemo(() => (member ? buildTimeline(member) : []), [member]);
  const isFound = member !== null;
  // A meeting history link names the note to open. The key changes on every visit, so choosing the
  // same note again still switches back to it.
  const linkedNoteId = searchParams.get('note') ?? getStateNoteId(locationState);
  const noteFocus = useMemo(
    () => (linkedNoteId ? { noteId: linkedNoteId, requestKey: locationKey } : null),
    [linkedNoteId, locationKey],
  );
  const [handledFocus, setHandledFocus] = useState<typeof noteFocus>(null);
  if (noteFocus !== handledFocus) {
    setHandledFocus(noteFocus);
    if (noteFocus) setActiveTab('notes');
  }

  // Orients screen reader users after navigating to a profile, including from one to another.
  // A linked note takes focus instead.
  useEffect(() => {
    if (!linkedNoteId) headingRef.current?.focus();
  }, [id, isFound, linkedNoteId]);

  const handleStartLive = async () => {
    try {
      await storage.loadPrivate();
    } catch {
      showToast("Couldn't start the 1:1. Unlock your notes and try again.", 'error');
      return;
    }
    setRateNoteId(null);
    setIsLive(true);
  };

  // Mood is asked after the meeting, on the profile, once the note it belongs to exists.
  const handleEndLive = (_session: LiveSession, note: Note) => {
    setIsLive(false);
    setRateNoteId(note.id);
    showToast('1:1 saved', 'success');
  };

  const goToRoster = () => navigate('/roster');

  // A removed person's 1:1 history, action items, decisions, tasks, reminders, key dates, leave, growth history, skills, connections, feedback, private notes and mood ratings must not linger in the
  // encrypted store. Best effort: the person is already gone, so a failure here must not turn a
  // successful delete into an error.
  const purgePrivateData = async (memberId: string) => {
    await deleteShareTokensForMember(memberId, storage).catch(() => undefined);
    try {
      await storage.loadPrivate();
    } catch {
      return;
    }
    // Left in the private envelope on failure; the next successful write does not resurrect the
    // member. Each purge runs on its own so one failure does not strand the other's data.
    await deleteNotesForMember(memberId, storage).catch(() => undefined);
    await deleteAgendaForMember(memberId, storage).catch(() => undefined);
    await deleteActionItemsForMember(memberId, storage).catch(() => undefined);
    await deleteMoodEntriesForMember(memberId, storage).catch(() => undefined);
    await deleteDecisionsForMember(memberId, storage).catch(() => undefined);
    await deleteTodosForMember(memberId, storage).catch(() => undefined);
    await deleteRemindersForMember(memberId, storage).catch(() => undefined);
    await deleteDateEventsForMember(memberId, storage).catch(() => undefined);
    await deleteLeaveForMember(memberId, storage).catch(() => undefined);
    await deleteGrowthForMember(memberId, storage).catch(() => undefined);
    await deleteSkillsForMember(memberId, storage).catch(() => undefined);
    // Removes links the person added and links others added to them, so none points at nobody.
    await deleteConnectionsForMember(memberId, storage).catch(() => undefined);
    await deleteFeedbackForMember(memberId, storage).catch(() => undefined);
    await deletePrivateNotesForMember(memberId, storage).catch(() => undefined);
  };

  const handleDelete = async () => {
    if (!member) return;
    const { name } = member;
    setIsDeleteOpen(false);
    setIsDeleting(true);
    try {
      await deleteMember(member.id, storage);
      await purgePrivateData(member.id);
      showToast(`${name} removed from your team`, 'success');
      goToRoster();
    } catch {
      setIsDeleting(false);
      showToast('Failed to delete. Try again.', 'error');
    }
  };

  // The member disappears from storage before the write is confirmed; avoid flashing the 404.
  if (isDeleting) return null;

  if (!member) {
    return (
      <EmptyState
        icon={<TeamIcon size={48} />}
        title="Person not found"
        headingLevel={1}
        titleRef={headingRef}
        action={{ label: 'Back to team', onClick: goToRoster }}
      />
    );
  }

  return (
    <>
      <Link className="profile-back" to="/roster">
        <span aria-hidden="true">←</span> Team
      </Link>
      <ProfileHeader
        member={member}
        headingRef={headingRef}
        onEdit={() => setIsEditOpen(true)}
        onStartOneOnOne={() => void handleStartLive()}
        onAddReminder={() => setIsReminderOpen(true)}
        onLogFeedback={() => void openQuickAdd(member.id)}
        onDelete={() => setIsDeleteOpen(true)}
        shareAction={<ShareButton member={member} />}
      />
      <ScheduleCard
        key={`schedule-${member.id}`}
        memberId={member.id}
        schedule={member.schedule ?? null}
        onSave={(schedule) => updateMember(member.id, { schedule }, storage)}
      />
      {isLive ? null : (
        <PrepPrompts key={`prep-${member.id}`} memberId={member.id} className="prep-card--page" />
      )}
      {isLive ? null : (
        <AgendaSection
          key={`agenda-${member.id}`}
          memberId={member.id}
          memberName={member.name}
          mode="prep"
        />
      )}
      {isLive ? null : <ReminderList key={`reminders-${member.id}`} person={member} />}
      {rateNoteId && isMoodTrackingEnabled(storage) ? (
        <section className="profile-mood-prompt" aria-label="Rate this 1:1">
          <MoodPrompt key={rateNoteId} memberId={member.id} noteId={rateNoteId} />
        </section>
      ) : null}
      <Tabs
        ariaLabel="Profile sections"
        activeId={activeTab}
        onActiveChange={setActiveTab}
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <>
                <ProfileOverview member={member} manager={manager} />
                <KeyDates key={`dates-${member.id}`} member={member} />
                <ActiveTokensList key={`tokens-${member.id}`} memberId={member.id} />
                <PrivateNotes key={`private-notes-${member.id}`} member={member} />
              </>
            ),
          },
          {
            id: 'notes',
            label: 'Notes',
            content: (
              <NotesSection
                key={member.id}
                memberId={member.id}
                focus={activeTab === 'notes' ? noteFocus : null}
              />
            ),
          },
          {
            id: 'meetings',
            label: 'Meetings',
            content: <MeetingsPanel key={member.id} memberId={member.id} />,
          },
          {
            id: 'decisions',
            label: 'Decisions & Follow-ups',
            content: <DecisionsPanel key={member.id} memberId={member.id} />,
          },
          {
            id: 'goals',
            label: 'Goals',
            content: <p className="profile-placeholder">Goals are coming in a future update.</p>,
          },
          {
            id: 'growth',
            label: 'Growth',
            // Mounted only while open, so career history is not in the page until it is asked for.
            content:
              activeTab === 'growth' ? <GrowthPanel key={member.id} member={member} /> : null,
          },
          {
            id: 'skills',
            label: 'Skills',
            // Mounted only while open, like growth: assessments stay out of the page until asked for.
            content:
              activeTab === 'skills' ? <SkillsPanel key={member.id} memberId={member.id} /> : null,
          },
          {
            id: 'connections',
            label: 'Connections',
            // Mounted only while open, like growth: who works with whom stays out of the page until asked for.
            content:
              activeTab === 'connections' ? (
                <ConnectionsPanel key={member.id} memberId={member.id} />
              ) : null,
          },
          {
            id: 'feedback',
            label: 'Feedback',
            badge: feedbackCount,
            // Mounted only while open, like growth: observations stay out of the page until asked for.
            content:
              activeTab === 'feedback' ? <FeedbackPanel key={member.id} member={member} /> : null,
          },
          { id: 'timeline', label: 'Timeline', content: <Timeline entries={timeline} /> },
        ]}
      />
      {isLive ? (
        <LiveMode
          key={`live-${member.id}`}
          memberId={member.id}
          memberName={member.name}
          avatarUrl={member.avatarUrl}
          onEnd={handleEndLive}
        />
      ) : null}
      <MoodTrendSection key={`mood-${member.id}`} memberId={member.id} />
      {quickAddModal}
      <AddMemberModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={(updated) => showToast(`${updated.name} updated`, 'success')}
        members={members}
        editMember={member}
      />
      <ReminderForm
        isOpen={isReminderOpen}
        onClose={() => setIsReminderOpen(false)}
        onSubmit={async (input) => {
          await createReminder(input);
          showToast('Reminder saved', 'success');
        }}
        members={members}
        person={member}
      />
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete ${member.name}?`}
        message="This removes them from your team and clears them as anyone's manager. This can't be undone."
        confirmLabel="Delete"
      />
    </>
  );
}

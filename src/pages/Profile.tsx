import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AddMemberModal } from '../components/AddMemberModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { TeamIcon } from '../components/icons';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileOverview } from '../components/ProfileOverview';
import { Tabs } from '../components/Tabs';
import { Timeline } from '../components/Timeline';
import { deleteMember, getMember, listMembers } from '../data/members';
import { buildTimeline } from '../data/timeline';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import '../styles/profile.css';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Profile() {
  const { id = '' } = useParams();
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const members = useMemo(() => listMembers(storage), [storage]);
  // Anything that is not a UUID is rejected before it reaches the store.
  const member = useMemo(
    () => (UUID_PATTERN.test(id) ? getMember(id, storage) : null),
    [id, storage],
  );
  const manager = member?.manager ? (members.find((m) => m.id === member.manager) ?? null) : null;
  const timeline = useMemo(() => (member ? buildTimeline(member) : []), [member]);
  const isFound = member !== null;

  // Orients screen reader users after navigating to a profile, including from one to another.
  useEffect(() => {
    headingRef.current?.focus();
  }, [id, isFound]);

  const goToRoster = () => navigate('/roster');

  const handleDelete = async () => {
    if (!member) return;
    const { name } = member;
    setIsDeleteOpen(false);
    setIsDeleting(true);
    try {
      await deleteMember(member.id, storage);
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
        onDelete={() => setIsDeleteOpen(true)}
      />
      <Tabs
        ariaLabel="Profile sections"
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: <ProfileOverview member={member} manager={manager} />,
          },
          {
            id: 'notes',
            label: 'Notes',
            content: <p className="profile-placeholder">Notes are coming in a future update.</p>,
          },
          {
            id: 'goals',
            label: 'Goals',
            content: <p className="profile-placeholder">Goals are coming in a future update.</p>,
          },
          { id: 'timeline', label: 'Timeline', content: <Timeline entries={timeline} /> },
        ]}
      />
      <AddMemberModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={(updated) => showToast(`${updated.name} updated`, 'success')}
        members={members}
        editMember={member}
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

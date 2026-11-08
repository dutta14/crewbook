import { useState } from 'react';
import type { TeamMember } from '../types/TeamMember';
import { AddMemberForm } from './AddMemberForm';
import { Modal } from './Modal';

export interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The caller refreshes its list and shows the toast. */
  onSuccess: (member: TeamMember) => void;
  /** Populates the manager dropdown. */
  members: TeamMember[];
  /** When provided the form is pre-filled and saves through updateMember. */
  editMember?: TeamMember;
}

export function AddMemberModal({
  isOpen,
  onClose,
  onSuccess,
  members,
  editMember,
}: AddMemberModalProps) {
  // The dialog stays mounted briefly while it animates out, so each opening gets a fresh form
  // instead of inheriting whatever was typed before.
  const [openCount, setOpenCount] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setOpenCount((count) => count + 1);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editMember ? 'Edit Team Member' : 'Add Team Member'}
      size="md"
      mobileSheet
    >
      <AddMemberForm
        key={openCount}
        members={members}
        editMember={editMember}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  );
}

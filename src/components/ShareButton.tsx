import { useState } from 'react';
import '../styles/button.css';
import '../styles/share.css';
import type { TeamMember } from '../types/TeamMember';
import { ShareLinkPopover } from './ShareLinkPopover';
import { ShareIcon } from './icons';

export function ShareButton({ member }: { member: TeamMember }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary share-button"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <ShareIcon size={16} />
        Share 1:1
      </button>
      {isOpen ? <ShareLinkPopover member={member} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

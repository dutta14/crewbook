import { useDocumentLinks } from '../hooks/useDocumentLinks';
import { DocumentLinks } from './DocumentLinks';
import { PrivateGate } from './PrivateGate';

/** One person's document links for their profile. They live in the private envelope. */
export function DocumentsPanel({ memberId }: { memberId: string }) {
  return (
    <PrivateGate label="documents">
      <MemberDocuments memberId={memberId} />
    </PrivateGate>
  );
}

function MemberDocuments({ memberId }: { memberId: string }) {
  const { links, addLink, editLink, removeLink } = useDocumentLinks(memberId);
  return (
    <DocumentLinks
      links={links}
      onAddLink={addLink}
      onEditLink={editLink}
      onRemoveLink={removeLink}
    />
  );
}

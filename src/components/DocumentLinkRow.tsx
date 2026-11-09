import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { DocumentLink, DocumentLinkInput } from '../types/document';
import { getUrlHostname, normalizeExternalUrl } from '../utils/externalUrl';
import { formatRelativeDate, isIsoDate } from '../utils/relativeDate';
import '../styles/button.css';
import '../styles/documents.css';
import { DocumentLinkForm } from './DocumentLinkForm';
import { ExternalLinkIcon, PencilIcon, TrashIcon } from './icons';

interface DocumentLinkRowProps {
  link: DocumentLink;
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, values: DocumentLinkInput) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

/** Tracks a flag turning off, so focus can go back to the control that opened it. */
function useOnClose(isOpen: boolean, onClose: () => void) {
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (wasOpen.current && !isOpen) onClose();
    wasOpen.current = isOpen;
  });
}

// A damaged "updated" stamp falls back to when the link was added, then to "Unknown date".
function describeDate(link: DocumentLink) {
  const stamp = [link.updatedAt, link.createdAt].find(isIsoDate);
  const added = isIsoDate(link.createdAt)
    ? `Added ${new Date(link.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}`
    : undefined;
  return { stamp, text: stamp ? formatRelativeDate(stamp) : 'Unknown date', added };
}

export function DocumentLinkRow({
  link,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
}: DocumentLinkRowProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const promptId = useId();
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useOnClose(isEditing, () => editRef.current?.focus());
  useOnClose(isConfirming, () => deleteRef.current?.focus());

  useEffect(() => {
    if (isConfirming) cancelRef.current?.focus();
  }, [isConfirming]);

  if (isEditing) {
    return (
      <li className="doc-row doc-row--editing">
        <DocumentLinkForm
          initial={{ title: link.title, url: link.url, category: link.category }}
          onSubmit={(values) => onSaveEdit(link.id, values)}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }

  const handleConfirmKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setIsConfirming(false);
  };

  const handleRemove = async () => {
    try {
      await onRemove(link.id);
    } catch {
      // The failure has already been reported with a toast; the link stays as it was.
      setIsConfirming(false);
    }
  };

  // Re-checked here so nothing but a plain web address can ever reach an href.
  const href = normalizeExternalUrl(link.url);
  const hostname = href ? getUrlHostname(href) : '';
  const date = describeDate(link);

  return (
    <li className="doc-row">
      <span className="doc-row__icon">
        <ExternalLinkIcon size={16} />
      </span>
      <div className="doc-row__main">
        {href ? (
          <a
            className="doc-row__link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={href}
          >
            {link.title}
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        ) : (
          <span className="doc-row__link">{link.title}</span>
        )}
        {hostname ? <span className="doc-row__host">{hostname}</span> : null}
      </div>
      <time className="doc-row__date" dateTime={date.stamp} title={date.added}>
        {date.text}
      </time>
      {isConfirming ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- only listens for Escape
        <div
          className="doc-row__confirm"
          role="alertdialog"
          aria-label="Confirm removal"
          aria-describedby={promptId}
          onKeyDown={handleConfirmKeyDown}
        >
          <span id={promptId} className="doc-row__confirm-text">
            Remove this link?
          </span>
          <button
            type="button"
            className="btn btn-ghost doc-row__confirm-btn"
            onClick={() => void handleRemove()}
          >
            Yes
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost doc-row__confirm-btn"
            onClick={() => setIsConfirming(false)}
          >
            No
          </button>
        </div>
      ) : (
        <div className="doc-row__actions">
          <button
            ref={editRef}
            type="button"
            className="icon-btn"
            aria-label={`Edit ${link.title}`}
            onClick={() => onStartEdit(link.id)}
          >
            <PencilIcon size={16} />
          </button>
          <button
            ref={deleteRef}
            type="button"
            className="icon-btn"
            aria-label={`Remove ${link.title}`}
            onClick={() => setIsConfirming(true)}
          >
            <TrashIcon size={16} />
          </button>
        </div>
      )}
    </li>
  );
}

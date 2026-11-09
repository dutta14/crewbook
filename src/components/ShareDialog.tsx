import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/share.css';
import { getManagerName, setManagerName } from '../data/settings';
import { ValidationError } from '../data/errors';
import {
  ShareLockedError,
  cleanManagerName,
  createShareLink,
  type ShareLink,
} from '../data/shareStore';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import type { TeamMember } from '../types/TeamMember';
import { copyWithAutoClear } from '../utils/clipboard';
import { formatNoteDate } from '../utils/noteFormat';
import { ShareTooLargeError, ShareUnsupportedError } from '../utils/shareUrl';
import { Modal } from './Modal';
import { WarningIcon } from './icons';

// Past this many characters some chat and email apps cut links short.
const LONG_LINK_CHARACTERS = 4096;
const COPIED_RESET_MS = 2000;

function describeFailure(error: unknown): string {
  if (error instanceof ShareTooLargeError) {
    return 'There is too much shared content to fit in one link. Mark fewer notes as shared and try again.';
  }
  if (error instanceof ShareUnsupportedError) {
    return 'This browser cannot create share links. Try a recent version of Chrome, Edge, Safari or Firefox.';
  }
  if (error instanceof ValidationError || error instanceof ShareLockedError) return error.message;
  return 'Could not create the link. Try again.';
}

interface ShareDialogProps {
  member: TeamMember;
  onClose: () => void;
}

/** Mount only while open: closing drops the link from memory. */
export function ShareDialog({ member, onClose }: ShareDialogProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const storageRef = useRef(storage);
  const runRef = useRef(0);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(() => getManagerName(storage));
  const [link, setLink] = useState<ShareLink | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = useCallback(
    async (rawName: string) => {
      const run = (runRef.current += 1);
      const current = () => run === runRef.current;
      setIsBusy(true);
      setError(null);
      setLink(null);
      setAcknowledged(false);
      setCopied(false);
      try {
        const managerName = cleanManagerName(rawName);
        const created = await createShareLink(member.id, managerName, storageRef.current);
        if (!current()) return;
        setLink(created);
        if (managerName !== getManagerName(storageRef.current)) {
          // Remembering the name is a convenience; the link already works without it.
          await setManagerName(managerName, storageRef.current).catch(() => undefined);
        }
      } catch (failure) {
        if (current()) setError(describeFailure(failure));
      } finally {
        if (current()) setIsBusy(false);
      }
    },
    [member.id],
  );

  useEffect(() => {
    storageRef.current = storage;
  });

  useEffect(() => {
    // A returning manager gets the link straight away.
    const stored = getManagerName(storageRef.current);
    if (stored !== '') void create(stored);
    return () => {
      runRef.current += 1;
    };
  }, [create]);

  useEffect(() => {
    if (acknowledged) linkInputRef.current?.focus();
  }, [acknowledged]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleNameChange = (value: string) => {
    // A link made for another name must not stay on screen.
    runRef.current += 1;
    setName(value);
    setLink(null);
    setAcknowledged(false);
    setCopied(false);
    setError(null);
    setIsBusy(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void create(name);
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await copyWithAutoClear(link.url);
      setCopied(true);
    } catch {
      showToast('Could not copy the link. Select it and copy it by hand.', 'error');
    }
  };

  const isLong = link !== null && link.tokenLength > LONG_LINK_CHARACTERS;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Share 1:1 with ${member.name}`}
      size="md"
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="share-dialog">
        <form className="share-dialog__form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="share-manager-name">
              Your name
            </label>
            <input
              id="share-manager-name"
              className="form-input"
              type="text"
              value={name}
              maxLength={100}
              autoComplete="name"
              aria-describedby="share-manager-name-hint"
              onChange={(event) => handleNameChange(event.target.value)}
            />
            <span id="share-manager-name-hint" className="share-dialog__hint">
              Shown at the top of the page {member.name} will see.
            </span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={isBusy}>
            {link ? 'Create new link' : 'Create link'}
          </button>
        </form>

        <p className="share-dialog__hint">
          The link holds a snapshot of the notes, action items and agenda items you have marked as
          shared. Anything you change later is not included. Create a new link to share updates.
        </p>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {link && !acknowledged ? (
          <div className="share-dialog__warning" role="alert">
            <WarningIcon size={16} />
            <div>
              <p className="share-dialog__warning-text">
                This link contains your 1:1 data. Share it only with your direct report. Anyone with
                this link can view its contents until it expires.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAcknowledged(true)}
              >
                I understand
              </button>
            </div>
          </div>
        ) : null}

        {link && acknowledged ? (
          <div className="share-dialog__link">
            <label className="form-label" htmlFor="share-link">
              Share link
            </label>
            <div className="share-dialog__link-row">
              <input
                id="share-link"
                ref={linkInputRef}
                className="form-input"
                type="text"
                readOnly
                value={link.url}
                aria-label="Share link"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button type="button" className="btn btn-primary" onClick={() => void handleCopy()}>
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <span className="sr-only" role="status">
              {copied ? 'Link copied to the clipboard' : ''}
            </span>
            <p className="share-dialog__hint">
              Expires{' '}
              <time dateTime={link.payload.expiresAt}>
                {formatNoteDate(link.payload.expiresAt)}
              </time>
              . About {Math.max(1, Math.ceil(link.url.length / 1024))} KB.
            </p>
            {isLong ? (
              <p className="share-dialog__hint share-dialog__hint--warn" role="status">
                This link is long. Some chat and email apps may cut it off. Mark fewer notes as
                shared to shorten it.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

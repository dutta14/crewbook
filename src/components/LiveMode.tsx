import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { MANAGER_OWNER_ID, createActionItem } from '../data/actionItems';
import { ValidationError } from '../data/errors';
import { NOTE_MAX_LENGTH, getDraft, saveDraft, saveLiveSession } from '../data/notes';
import {
  areLiveShortcutsEnabled,
  dismissLiveNotice,
  isLiveNoticeDismissed,
  setLiveShortcutsEnabled,
} from '../data/settings';
import { useAutoSave, type AutoSaveStatus } from '../hooks/useAutoSave';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTimer } from '../hooks/useTimer';
import { useToast } from '../hooks/useToast';
import type { CaptureType, LiveSession, QuickCaptureItem } from '../types/LiveSession';
import type { Note } from '../types/Note';
import {
  CAPTURE_LABELS,
  CAPTURE_TITLE_MAX_LENGTH,
  appendCapture,
  cleanCaptureTitle,
} from '../utils/liveCapture';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/pages/live-mode.css';
import { Avatar } from './Avatar';
import { ContextSidebar } from './ContextSidebar';
import { MenuIcon } from './icons';
import { LiveModeNotice } from './LiveModeNotice';
import { QuickCapture, type CaptureRequest } from './QuickCapture';
import { ShortcutSettings } from './ShortcutSettings';

interface LiveModeProps {
  memberId: string;
  memberName: string;
  avatarUrl?: string;
  /** Called once the session is saved as a note and the overlay has finished closing. */
  onEnd: (session: LiveSession, note: Note) => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Matches the close animation in live-mode.css.
const EXIT_DURATION_MS = 250;
const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const END_FAILED = "Couldn't save this 1:1. Your notes are still here, so try again.";
const SETTING_FAILED = "Couldn't save that setting. Try again.";

const STATUS_LABELS: Record<AutoSaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

/**
 * A near-full-screen 1:1: notes on the left, context on the right. Notes auto-save to the
 * member's encrypted draft; "End 1:1" is the only way out and turns them into a note. Needs the
 * private envelope to be loaded already.
 */
export function LiveMode({ memberId, memberName, avatarUrl, onEnd }: LiveModeProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const sidebarId = useId();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const overlayRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const startedAt = useRef(new Date().toISOString());
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set while a session is being ended, so a late auto-save cannot bring the draft back.
  const isEnding = useRef(false);
  const [content, setContent] = useState(() => getDraft(memberId, storage));
  const [captures, setCaptures] = useState<QuickCaptureItem[]>([]);
  const [capture, setCapture] = useState<CaptureRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [endError, setEndError] = useState('');
  const [shortcutsEnabled, setShortcutsEnabled] = useState(() => areLiveShortcutsEnabled(storage));
  const [showNotice, setShowNotice] = useState(() => !isLiveNoticeDismissed(storage));
  const { elapsed, startTimer, stopTimer } = useTimer();

  const { status, isDirty } = useAutoSave(content, async (value) => {
    if (isEnding.current) return;
    await saveDraft(memberId, value, storage);
  });

  useEffect(() => {
    startTimer();
  }, [startTimer]);

  // Focus goes to the notes on open and back to whatever opened live mode on close.
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
    }
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  // Leaving without ending, for example with the browser's back button, keeps the latest text.
  const latest = useRef({ content, storage, isDirty });
  useEffect(() => {
    latest.current = { content, storage, isDirty };
  });
  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      const { content: pending, storage: current, isDirty: hasUnsaved } = latest.current;
      if (!isEnding.current && hasUnsaved)
        saveDraft(memberId, pending, current).catch(() => undefined);
    },
    [memberId],
  );

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const openCapture = (type: CaptureType) =>
    setCapture((current) => ({ type, nonce: (current?.nonce ?? 0) + 1 }));

  useKeyboardShortcut('mod+shift+a', () => openCapture('action'), shortcutsEnabled);
  useKeyboardShortcut('mod+shift+d', () => openCapture('decision'), shortcutsEnabled);

  const handleCapture = async (type: CaptureType, rawTitle: string) => {
    const title = cleanCaptureTitle(rawTitle);
    if (title.length === 0) throw new ValidationError('Title is required');
    if (title.length > CAPTURE_TITLE_MAX_LENGTH) {
      throw new ValidationError(`Title must be ${CAPTURE_TITLE_MAX_LENGTH} characters or fewer`);
    }
    const next = appendCapture(content, type, title);
    if (next.length > NOTE_MAX_LENGTH) {
      throw new ValidationError('Your notes are full. Make room, then try again.');
    }
    if (type === 'action') {
      await createActionItem({ memberId, title, ownerId: MANAGER_OWNER_ID }, storage);
    }
    setContent(next);
    setCaptures((current) => [
      ...current,
      { id: crypto.randomUUID(), type, title, createdAt: new Date().toISOString() },
    ]);
    showToast(`${CAPTURE_LABELS[type]} added`, 'success');
  };

  const handleEnd = async () => {
    if (isSaving || isClosing) return;
    isEnding.current = true;
    setIsSaving(true);
    setEndError('');
    const session: LiveSession = {
      memberId,
      content,
      captures,
      startedAt: startedAt.current,
      endedAt: new Date().toISOString(),
    };
    let note: Note;
    try {
      note = await saveLiveSession(session, storage);
    } catch (error) {
      isEnding.current = false;
      setIsSaving(false);
      setEndError(error instanceof ValidationError ? error.message : END_FAILED);
      return;
    }
    stopTimer();
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      onEnd(session, note);
      return;
    }
    setIsClosing(true);
    exitTimer.current = setTimeout(() => onEnd(session, note), EXIT_DURATION_MS);
  };

  const handleShortcutsChange = (enabled: boolean) => {
    setShortcutsEnabled(enabled);
    setLiveShortcutsEnabled(enabled, storage).catch(() => {
      setShortcutsEnabled(!enabled);
      showToast(SETTING_FAILED, 'error');
    });
  };

  const handleDismissNotice = () => {
    setShowNotice(false);
    editorRef.current?.focus();
    dismissLiveNotice(storage).catch(() => undefined);
  };

  // Tab stays inside the overlay, wrapping at either end. Escape is deliberately not handled.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => !element.closest('[inert]'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!first || !last) {
      event.preventDefault();
    } else if (event.shiftKey && (active === first || active === overlay)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const statusLabel = STATUS_LABELS[status];

  return createPortal(
    // The dialog role makes this element interactive; the rule cannot tell from a literal role.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={overlayRef}
      className={`live-mode-overlay${isClosing ? ' live-mode-overlay--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`1:1 with ${memberName}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <header className="live-mode__bar">
        <div className="live-mode__who">
          <Avatar name={memberName} size="sm" avatarUrl={avatarUrl} aria-hidden />
          <h2 className="live-mode__name">{memberName}</h2>
        </div>
        <span className="live-mode__timer tnum" role="timer" aria-live="off">
          {elapsed}
        </span>
        <div className="live-mode__bar-actions">
          {isMobile ? (
            <button
              type="button"
              className="icon-btn"
              aria-label="Show context"
              aria-expanded={isDrawerOpen}
              aria-controls={sidebarId}
              onClick={() => setIsDrawerOpen((current) => !current)}
            >
              <MenuIcon />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-danger"
            aria-label="End 1:1 meeting and save"
            aria-disabled={isSaving}
            onClick={() => void handleEnd()}
          >
            End 1:1
          </button>
        </div>
      </header>
      <div className="live-mode__content">
        <section className="live-mode__editor" aria-label="Notes">
          <div className="live-mode__editor-scroll">
            <div className="live-mode__editor-header">
              {showNotice ? <LiveModeNotice onDismiss={handleDismissNotice} /> : null}
              <span
                className={`live-mode__save-status${statusLabel ? ' live-mode__save-status--visible' : ''}`}
                role="status"
                aria-live="polite"
              >
                {statusLabel}
              </span>
            </div>
            {endError ? (
              <p className="form-error" role="alert">
                {endError}
              </p>
            ) : null}
            <label className="sr-only" htmlFor={`${sidebarId}-notes`}>
              1:1 notes
            </label>
            <textarea
              ref={editorRef}
              id={`${sidebarId}-notes`}
              className="live-mode__textarea"
              placeholder="Write as you talk. Markdown is supported."
              maxLength={NOTE_MAX_LENGTH}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          <QuickCapture
            active={capture}
            onOpen={openCapture}
            onClose={() => setCapture(null)}
            onSubmit={handleCapture}
            editorRef={editorRef}
          />
        </section>
        <ContextSidebar
          id={sidebarId}
          memberId={memberId}
          isOpen={isDrawerOpen}
          isInert={isMobile && !isDrawerOpen}
          footer={<ShortcutSettings enabled={shortcutsEnabled} onChange={handleShortcutsChange} />}
        />
      </div>
    </div>,
    document.body,
  );
}

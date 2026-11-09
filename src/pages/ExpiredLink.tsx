import { useEffect } from 'react';
import '../styles/shared-view.css';
import { useDarkMode } from '../hooks/useDarkMode';
import { ClockIcon } from '../components/icons';

export type ExpiredLinkReason = 'expired' | 'invalid';

const COPY: Record<ExpiredLinkReason, { title: string; body: string }> = {
  expired: {
    title: 'This link has expired',
    body: 'Ask your manager to generate a new share link.',
  },
  invalid: {
    title: 'This link is invalid or has been tampered with',
    body: 'It may be incomplete or have been changed. Ask your manager to generate a new share link.',
  },
};

/** Static text only: nothing from the link is shown, so a bad link can reveal nothing. */
export function ExpiredLink({ reason }: { reason: ExpiredLinkReason }) {
  useDarkMode();
  const { title, body } = COPY[reason];

  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <main
      className="shared-view shared-view--message shared-view--fade"
      aria-labelledby="shared-view-message-title"
    >
      <span className="shared-view__message-icon">
        <ClockIcon size={32} />
      </span>
      <h1 id="shared-view-message-title" className="shared-view__title">
        {title}
      </h1>
      <p className="shared-view__message">{body}</p>
    </main>
  );
}

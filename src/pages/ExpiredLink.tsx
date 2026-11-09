import { useEffect } from 'react';
import '../styles/shared-view.css';
import { useDarkMode } from '../hooks/useDarkMode';

export type ExpiredLinkReason = 'expired' | 'invalid';

const COPY: Record<ExpiredLinkReason, { title: string; body: string }> = {
  expired: {
    title: 'This link has expired',
    body: 'Shared 1:1 links stop working after a while. Ask your manager for a new link.',
  },
  invalid: {
    title: 'This link is invalid or has been tampered with',
    body: 'It may be incomplete or have been changed. Ask your manager for a new link.',
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
    <main className="shared-view shared-view--message" aria-labelledby="shared-view-message-title">
      <h1 id="shared-view-message-title" className="shared-view__title">
        {title}
      </h1>
      <p className="shared-view__message">{body}</p>
    </main>
  );
}

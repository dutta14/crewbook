import { useMemo, useRef, useState } from 'react';
import '../styles/button.css';
import '../styles/share-link.css';
import { revokeToken, getActiveTokens } from '../data/shareStore';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useNow } from '../hooks/useNow';
import { useToast } from '../hooks/useToast';
import type { ShareToken } from '../types/sharing';
import { describeTimeLeft, isExpiringSoon } from '../utils/shareExpiry';
import { ConfirmDialog } from './ConfirmDialog';

const SNIPPET_LENGTH = 8;
const snippet = (token: ShareToken) => token.id.slice(0, SNIPPET_LENGTH);

/** The links made for one person that still work. Revoking only stops them in this browser. */
export function ActiveTokensList({ memberId }: { memberId: string }) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const now = useNow();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState<ShareToken | null>(null);
  const tokens = useMemo(
    () => getActiveTokens(memberId, storage, new Date(now)),
    [memberId, storage, now],
  );

  const confirmRevoke = async () => {
    if (!pending) return;
    const target = pending;
    setPending(null);
    try {
      await revokeToken(target.id, storage);
      showToast('Link revoked', 'success');
      // The button that opened the dialog is gone, so focus goes to the section.
      headingRef.current?.focus();
    } catch {
      showToast('Could not revoke the link. Try again.', 'error');
    }
  };

  return (
    <section className="share-tokens" aria-labelledby="share-tokens-title">
      <h3 id="share-tokens-title" ref={headingRef} tabIndex={-1} className="share-tokens__title">
        Active share links
      </h3>
      {tokens.length === 0 ? (
        <p className="share-tokens__empty">No active share links.</p>
      ) : (
        <div className="share-tokens__scroll">
          <table className="share-tokens__table" aria-label="Active share links">
            <thead>
              <tr>
                <th scope="col">Link</th>
                <th scope="col">Expires</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => {
                const soon = isExpiringSoon(token.expiresAt, now);
                return (
                  <tr key={token.id} className="share-tokens__row">
                    <td>
                      <code className="share-tokens__id">{snippet(token)}</code>
                    </td>
                    <td>
                      <time
                        dateTime={token.expiresAt}
                        className={`share-tokens__time${soon ? ' share-tokens__time--soon' : ''}`}
                      >
                        Expires in {describeTimeLeft(token.expiresAt, now)}
                      </time>
                    </td>
                    <td className="share-tokens__actions">
                      <button
                        type="button"
                        className="btn btn-secondary share-tokens__revoke"
                        aria-label={`Revoke share link ${snippet(token)}`}
                        onClick={() => setPending(token)}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        isOpen={pending !== null}
        title="Revoke this link?"
        message="This will immediately revoke access for anyone with this link."
        confirmLabel="Revoke link"
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmRevoke()}
      />
    </section>
  );
}

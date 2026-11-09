import { useEffect, useRef, useState } from 'react';
import { isTokenValid } from '../data/shareStore';
import type { SharedViewPayload, SharedViewStatus } from '../types/sharing';
import { CLOCK_SKEW_MS, isBeyondMaxLifetime, isPastExpiry, msUntil } from '../utils/shareExpiry';
import { readShareToken } from '../utils/shareUrl';
import { useEncryptedStorage } from './useEncryptedStorage';

export interface SharedViewState {
  status: SharedViewStatus;
  data: SharedViewPayload | null;
}

const LOADING: SharedViewState = { status: 'loading', data: null };
const INVALID: SharedViewState = { status: 'invalid', data: null };
const EXPIRED: SharedViewState = { status: 'expired', data: null };

/**
 * Decodes the token from the address; nothing is kept, so every load reads the link afresh. The
 * signature is checked only when this browser holds the signing key, which is the manager's own
 * unlocked session; a recipient has no key, so for them only the shape, size and expiry checks
 * apply. Expiry is decided before any data reaches the page, and a link that runs out while it is
 * open drops its data in place. A link the manager revoked is refused only in the manager's own
 * browser, and looks exactly like an expired one.
 */
export function useSharedView(token: string | undefined): SharedViewState {
  const storage = useEncryptedStorage();
  const { getShareSigningKey } = storage;
  const storageRef = useRef(storage);
  const [state, setState] = useState<SharedViewState>(LOADING);

  useEffect(() => {
    storageRef.current = storage;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (next: SharedViewState) => {
      if (!cancelled) setState(next);
    };
    if (!token) {
      settle(INVALID);
      return undefined;
    }
    settle(LOADING);
    const key = getShareSigningKey();
    readShareToken(token, key)
      .then((payload) => {
        if (payload === null) return settle(INVALID);
        if (isBeyondMaxLifetime(payload.expiresAt)) return settle(INVALID);
        if (isPastExpiry(payload.expiresAt)) return settle(EXPIRED);
        // Only a verified link may be looked up: the id of one that failed the check means nothing.
        if (key !== null && isTokenValid(payload.id, storageRef.current).reason === 'revoked') {
          return settle(EXPIRED);
        }
        timer = setTimeout(() => settle(EXPIRED), msUntil(payload.expiresAt) + CLOCK_SKEW_MS);
        return settle({ status: 'valid', data: payload });
      })
      .catch(() => settle(INVALID));
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [token, getShareSigningKey]);

  return state;
}

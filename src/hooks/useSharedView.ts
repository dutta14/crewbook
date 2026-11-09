import { useEffect, useState } from 'react';
import type { SharedViewPayload, SharedViewStatus } from '../types/sharing';
import { readShareToken } from '../utils/shareUrl';
import { useEncryptedStorage } from './useEncryptedStorage';

export interface SharedViewState {
  status: SharedViewStatus;
  data: SharedViewPayload | null;
}

const LOADING: SharedViewState = { status: 'loading', data: null };
const INVALID: SharedViewState = { status: 'invalid', data: null };

/**
 * Decodes the token from the address. The signature is checked only when this browser holds the
 * signing key, which is the manager's own unlocked session; a recipient has no key, so for them
 * only the shape, size and expiry checks apply. An expired link never exposes its data.
 */
export function useSharedView(token: string | undefined): SharedViewState {
  const { getShareSigningKey } = useEncryptedStorage();
  const [state, setState] = useState<SharedViewState>(LOADING);

  useEffect(() => {
    let cancelled = false;
    const settle = (next: SharedViewState) => {
      if (!cancelled) setState(next);
    };
    if (!token) {
      settle(INVALID);
      return undefined;
    }
    settle(LOADING);
    readShareToken(token, getShareSigningKey())
      .then((payload) => {
        if (payload === null) return settle(INVALID);
        if (Date.parse(payload.expiresAt) <= Date.now()) {
          return settle({ status: 'expired', data: null });
        }
        return settle({ status: 'valid', data: payload });
      })
      .catch(() => settle(INVALID));
    return () => {
      cancelled = true;
    };
  }, [token, getShareSigningKey]);

  return state;
}

import { useEffect, useState } from 'react';
import { useEncryptedStorage } from './useEncryptedStorage';

/** Opens the private envelope on mount if it is not open yet. */
export function usePrivateEnvelope(): { isReady: boolean; loadFailed: boolean } {
  const { isPrivateUnlocked, loadPrivate } = useEncryptedStorage();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (isPrivateUnlocked) return undefined;
    let isCurrent = true;
    loadPrivate().catch(() => {
      if (isCurrent) setLoadFailed(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [isPrivateUnlocked, loadPrivate]);

  return { isReady: isPrivateUnlocked, loadFailed };
}

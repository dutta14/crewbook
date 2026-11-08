import { useCallback, useMemo } from 'react';
import { ValidationError } from '../data/errors';
import { addPrivateNote, getFlightRiskLevel, getPrivateNotes } from '../data/privateStore';
import { areRiskIndicatorsHidden } from '../data/settings';
import type { FlightRiskLevel, PrivateNote } from '../types/flightRisk';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that note. Nothing was stored. Try again.";

export interface UsePrivateNotes {
  /** Newest first. */
  notes: PrivateNote[];
  /** The level on the latest note, or 'none'. */
  currentFlightRisk: FlightRiskLevel;
  /**
   * Waits for the encrypted write, so the screen only changes once it has landed. A failed write
   * rolls back, shows an error toast and rejects; a ValidationError rejects without a toast so
   * the form can report it. Needs the private envelope to be open; see usePrivateEnvelope.
   */
  addNote: (text: string, flightRisk: FlightRiskLevel) => Promise<void>;
}

/** The only way the UI reads private notes, always scoped to one person. */
export function usePrivateNotes(engineerId: string): UsePrivateNotes {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const notes = useMemo(() => getPrivateNotes(storage, engineerId), [storage, engineerId]);
  const currentFlightRisk = notes[0]?.flightRisk ?? 'none';

  const addNote = useCallback(
    async (text: string, flightRisk: FlightRiskLevel) => {
      try {
        await addPrivateNote(engineerId, text, flightRisk, storage);
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(SAVE_FAILED, 'error');
        throw error;
      }
    },
    [engineerId, storage, showToast],
  );

  return { notes, currentFlightRisk, addNote };
}

/**
 * One person's level for the roster dot. 'none' while the private envelope is closed or the
 * manager has hidden the indicators, so a hidden dot is never even computed.
 */
export function useRiskIndicatorLevel(engineerId: string): FlightRiskLevel {
  const storage = useEncryptedStorage();
  return areRiskIndicatorsHidden(storage) ? 'none' : getFlightRiskLevel(storage, engineerId);
}

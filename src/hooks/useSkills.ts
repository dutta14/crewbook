import { useCallback, useMemo } from 'react';
import { ValidationError } from '../data/errors';
import {
  createSkill,
  deleteSkill,
  getAllSkills,
  getSkills,
  updateSkill,
  type SkillUpdate,
} from '../data/skillsStore';
import type { Skill, SkillInput } from '../types/skill';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that skill. Try again.";
const DELETE_FAILED = "Couldn't remove that skill. Try again.";

export interface UseSkills {
  skills: Skill[];
  /**
   * Every write waits for the encrypted store, so the screen only changes once it has landed.
   * A failed write rolls back and shows an error toast, then rejects so the caller can stand
   * down. A ValidationError rejects without a toast; the form reports it next to the field.
   * Needs the private envelope to be open; see usePrivateEnvelope.
   */
  addSkill: (skill: SkillInput) => Promise<void>;
  editSkill: (id: string, updates: SkillUpdate) => Promise<void>;
  removeSkill: (id: string) => Promise<void>;
}

export function useSkills(memberId: string): UseSkills {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const skills = useMemo(() => getSkills(storage, memberId), [storage, memberId]);

  const run = useCallback(
    async (operation: () => Promise<unknown>, failure: string) => {
      try {
        await operation();
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(failure, 'error');
        throw error;
      }
    },
    [showToast],
  );

  const addSkill = useCallback(
    (skill: SkillInput) => run(() => createSkill(memberId, skill, storage), SAVE_FAILED),
    [run, memberId, storage],
  );
  const editSkill = useCallback(
    (id: string, updates: SkillUpdate) => run(() => updateSkill(id, updates, storage), SAVE_FAILED),
    [run, storage],
  );
  const removeSkill = useCallback(
    (id: string) => run(() => deleteSkill(id, storage), DELETE_FAILED),
    [run, storage],
  );

  return { skills, addSkill, editSkill, removeSkill };
}

/** Everyone's skills for the team matrix. Needs the private envelope to be open. */
export function useTeamSkills(): Skill[] {
  const storage = useEncryptedStorage();
  return useMemo(() => getAllSkills(storage), [storage]);
}

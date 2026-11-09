import { useCallback, useEffect, useMemo } from 'react';
import {
  addCustomField,
  countMembersWithValue,
  editCustomField,
  hasOrphanedValues,
  listCustomFields,
  purgeOrphanedValues,
  removeCustomField,
  reorderCustomFields,
  type CustomFieldUpdate,
} from '../data/customFields';
import { CUSTOM_FIELD_LIMITS } from '../data/customFieldRules';
import { ValidationError } from '../data/errors';
import { getMember, updateMember } from '../data/members';
import type {
  CustomFieldDefinition,
  CustomFieldInput,
  CustomFieldValue,
} from '../types/customField';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that field. Try again.";
const DELETE_FAILED = "Couldn't delete that field. Try again.";
const VALUE_FAILED = "Couldn't save that value. Try again.";

export interface UseCustomFields {
  definitions: CustomFieldDefinition[];
  /** False once the limit is reached. The data layer enforces it too. */
  canAddField: boolean;
  /**
   * Every write waits for the encrypted store. A failed write rolls back, shows an error toast
   * and rejects. A ValidationError rejects without a toast; the form shows it beside the field.
   */
  addField: (field: CustomFieldInput) => Promise<void>;
  editField: (id: string, updates: CustomFieldUpdate) => Promise<void>;
  /** Also removes every member's value for the field, in the same write. */
  removeField: (id: string) => Promise<void>;
  reorderFields: (fromIndex: number, toIndex: number) => Promise<void>;
  /** The member's filled-in values, in the display order of their fields. */
  getMemberValues: (memberId: string) => CustomFieldValue[];
  setMemberValue: (memberId: string, fieldId: string, value: string) => Promise<void>;
  /** How many members have a value for the field. */
  countAffectedMembers: (fieldId: string) => number;
}

export function useCustomFields(): UseCustomFields {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const definitions = useMemo(() => listCustomFields(storage), [storage]);

  // Guards against an interrupted delete leaving values nobody can see or remove.
  const hasOrphans = storage.isUnlocked && hasOrphanedValues(storage);
  useEffect(() => {
    if (hasOrphans) void purgeOrphanedValues(storage).catch(() => undefined);
    // `storage` changes on every write; the effect only needs to run when orphans appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOrphans]);

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

  const addField = useCallback(
    (field: CustomFieldInput) => run(() => addCustomField(field, storage), SAVE_FAILED),
    [run, storage],
  );
  const editField = useCallback(
    (id: string, updates: CustomFieldUpdate) =>
      run(() => editCustomField(id, updates, storage), SAVE_FAILED),
    [run, storage],
  );
  const removeField = useCallback(
    (id: string) => run(() => removeCustomField(id, storage), DELETE_FAILED),
    [run, storage],
  );
  const reorderFields = useCallback(
    (fromIndex: number, toIndex: number) =>
      run(() => reorderCustomFields(fromIndex, toIndex, storage), SAVE_FAILED),
    [run, storage],
  );

  const getMemberValues = useCallback(
    (memberId: string): CustomFieldValue[] => {
      const values = getMember(memberId, storage)?.customFields ?? {};
      return definitions.flatMap((field) =>
        Object.hasOwn(values, field.id) && values[field.id] !== ''
          ? [{ fieldId: field.id, value: values[field.id] }]
          : [],
      );
    },
    [definitions, storage],
  );

  const setMemberValue = useCallback(
    (memberId: string, fieldId: string, value: string) =>
      run(async () => {
        const member = getMember(memberId, storage);
        if (!member) throw new ValidationError('That person is no longer on your team');
        await updateMember(
          memberId,
          { customFields: { ...member.customFields, [fieldId]: value } },
          storage,
        );
      }, VALUE_FAILED),
    [run, storage],
  );

  const countAffectedMembers = useCallback(
    (fieldId: string) => countMembersWithValue(fieldId, storage),
    [storage],
  );

  return {
    definitions,
    canAddField: definitions.length < CUSTOM_FIELD_LIMITS.count,
    addField,
    editField,
    removeField,
    reorderFields,
    getMemberValues,
    setMemberValue,
    countAffectedMembers,
  };
}

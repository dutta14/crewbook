import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { ProficiencyLevel, Skill, SkillCategory, SkillInput } from '../types/skill';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/** Proficiency ratings are performance-adjacent opinions, so they live in the private envelope. */
const STORAGE_KEY = 'skills';

/** Needs `get` as well because the person is validated against the team list. */
export type SkillsStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const SKILL_NAME_MAX_LENGTH = 100;
export const SKILL_NOTES_MAX_LENGTH = 500;

export const PROFICIENCY_LEVELS: readonly ProficiencyLevel[] = [
  'learning',
  'competent',
  'proficient',
  'expert',
];

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  learning: 'Learning',
  competent: 'Competent',
  proficient: 'Proficient',
  expert: 'Expert',
};

export const SKILL_CATEGORIES: readonly SkillCategory[] = ['strength', 'growth'];

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  strength: 'Strengths',
  growth: 'Growth Areas',
};

/** The fields a manager can change; id, person and timestamps are never taken from the caller. */
export type SkillUpdate = Partial<SkillInput>;

export function isProficiencyLevel(value: unknown): value is ProficiencyLevel {
  return typeof value === 'string' && (PROFICIENCY_LEVELS as readonly string[]).includes(value);
}

export function isSkillCategory(value: unknown): value is SkillCategory {
  return typeof value === 'string' && (SKILL_CATEGORIES as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isSkill(value: unknown): value is Skill {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.memberId) &&
    isString(item.name) &&
    isProficiencyLevel(item.level) &&
    isSkillCategory(item.category) &&
    isString(item.notes) &&
    item.visibility === 'private' &&
    isString(item.createdAt) &&
    isString(item.updatedAt)
  );
}

// A malformed skill is reported once per id; the message never carries anything the manager typed.
const reportedIds = new Set<string>();

function reportMalformed(value: unknown) {
  const id =
    typeof value === 'object' && value !== null && isString((value as { id?: unknown }).id)
      ? (value as { id: string }).id
      : 'unknown';
  if (reportedIds.has(id)) return;
  reportedIds.add(id);
  // eslint-disable-next-line no-console -- structural warning only; it names the skill, never its content
  console.warn(`Failed to parse skill ${id}`);
}

function readSkills(storage: SkillsStorage): Skill[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is Skill => {
    if (isSkill(item)) return true;
    reportMalformed(item);
    return false;
  });
}

/** Drops control characters; line breaks survive only when `keepLineBreaks` is set. */
function stripControl(value: string, keepLineBreaks: boolean): string {
  return Array.from(value)
    .filter((char) => (keepLineBreaks && char === '\n') || char.charCodeAt(0) > 0x1f)
    .join('');
}

const HTML_TAG = /<[^>]*>/;

function cleanName(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Skill name is required');
  const name = stripControl(value, false).trim();
  if (name === '') throw new ValidationError('Skill name is required');
  if (name.length > SKILL_NAME_MAX_LENGTH) {
    throw new ValidationError(`Skill name must be ${SKILL_NAME_MAX_LENGTH} characters or fewer`);
  }
  if (HTML_TAG.test(name)) throw new ValidationError('Skill name can not contain HTML tags');
  return name;
}

function cleanNotes(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError('Notes must be text');
  const notes = stripControl(value, true).trim();
  if (notes.length > SKILL_NOTES_MAX_LENGTH) {
    throw new ValidationError(`Notes must be ${SKILL_NOTES_MAX_LENGTH} characters or fewer`);
  }
  return notes;
}

function cleanLevel(value: unknown): ProficiencyLevel {
  if (!isProficiencyLevel(value)) throw new ValidationError('Proficiency level is not valid');
  return value;
}

function cleanCategory(value: unknown): SkillCategory {
  if (!isSkillCategory(value)) throw new ValidationError('Skill section is not valid');
  return value;
}

function requireMember(memberId: unknown, storage: SkillsStorage): string {
  if (typeof memberId !== 'string' || !getMember(memberId, storage)) {
    throw new ValidationError('This needs a team member');
  }
  return memberId;
}

/** A person can list the same skill as a strength and as a growth area, but not twice in one. */
function rejectDuplicate(existing: Skill[], candidate: Skill) {
  const key = candidate.name.toLowerCase();
  const clash = existing.some(
    (item) =>
      item.id !== candidate.id &&
      item.memberId === candidate.memberId &&
      item.category === candidate.category &&
      item.name.toLowerCase() === key,
  );
  if (clash) {
    throw new ValidationError(
      `${SKILL_CATEGORY_LABELS[candidate.category]} already has a skill with that name`,
    );
  }
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(storage: SkillsStorage, previous: Skill[], next: Skill[]): Promise<void> {
  storage.setPrivate(STORAGE_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

export function createSkill(
  memberId: string,
  input: SkillInput,
  storage: SkillsStorage,
): Promise<Skill> {
  return enqueue(async () => {
    const timestamp = new Date().toISOString();
    const skill: Skill = {
      id: crypto.randomUUID(),
      memberId: requireMember(memberId, storage),
      name: cleanName(input.name),
      level: cleanLevel(input.level),
      category: cleanCategory(input.category),
      notes: cleanNotes(input.notes),
      visibility: 'private',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const previous = readSkills(storage);
    rejectDuplicate(previous, skill);
    await commit(storage, previous, [...previous, skill]);
    return { ...skill };
  });
}

export function updateSkill(
  id: string,
  updates: SkillUpdate,
  storage: SkillsStorage,
): Promise<Skill> {
  return enqueue(async () => {
    const previous = readSkills(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated: Skill = {
      ...existing,
      name: 'name' in updates ? cleanName(updates.name) : existing.name,
      level: 'level' in updates ? cleanLevel(updates.level) : existing.level,
      category: 'category' in updates ? cleanCategory(updates.category) : existing.category,
      notes: 'notes' in updates ? cleanNotes(updates.notes) : existing.notes,
      updatedAt: new Date().toISOString(),
    };
    rejectDuplicate(previous, updated);
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated };
  });
}

export function deleteSkill(id: string, storage: SkillsStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readSkills(storage);
    if (!previous.some((item) => item.id === id)) throw new NotFoundError(id);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.id !== id),
    );
  });
}

/** One person's skills in the order they were added. */
export function getSkills(storage: SkillsStorage, memberId: string): Skill[] {
  return readSkills(storage)
    .filter((item) => item.memberId === memberId)
    .map((item) => ({ ...item }));
}

/** Everyone's skills, for the team matrix. */
export function getAllSkills(storage: SkillsStorage): Skill[] {
  return readSkills(storage).map((item) => ({ ...item }));
}

/** Removes every skill for a member, for when they leave the team. */
export function deleteSkillsForMember(memberId: string, storage: SkillsStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readSkills(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.memberId !== memberId),
    );
  });
}

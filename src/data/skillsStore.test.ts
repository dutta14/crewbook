import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember, createSkill as buildSkill } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  SKILL_NAME_MAX_LENGTH,
  SKILL_NOTES_MAX_LENGTH,
  createSkill,
  deleteSkill,
  deleteSkillsForMember,
  getAllSkills,
  getSkills,
  isProficiencyLevel,
  isSkillCategory,
  updateSkill,
  type SkillsStorage,
} from './skillsStore';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const flush = vi.fn(async () => failure);
  const storage: SkillsStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

const input = (overrides: Partial<Parameters<typeof createSkill>[1]> = {}) => ({
  name: 'TypeScript',
  level: 'proficient' as const,
  category: 'strength' as const,
  notes: 'Owns the type system',
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('createSkill', () => {
  it('stores a private, timestamped skill in the private envelope and flushes', async () => {
    const { storage, data, flush } = createStorage();

    const skill = await createSkill(ALEX.id, input(), storage);

    expect(skill).toMatchObject({
      memberId: ALEX.id,
      name: 'TypeScript',
      level: 'proficient',
      category: 'strength',
      visibility: 'private',
    });
    expect(skill.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(skill.createdAt).toBe(skill.updatedAt);
    expect(data.get('skills')).toEqual([skill]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('trims the name, strips control characters and defaults notes to empty', async () => {
    const { storage } = createStorage();

    const skill = await createSkill(
      ALEX.id,
      { name: '  Type\u0007Script \n', level: 'learning', category: 'growth' },
      storage,
    );

    expect(skill.name).toBe('TypeScript');
    expect(skill.notes).toBe('');
  });

  it('keeps line breaks in notes', async () => {
    const { storage } = createStorage();

    const skill = await createSkill(ALEX.id, input({ notes: 'one\ntwo' }), storage);

    expect(skill.notes).toBe('one\ntwo');
  });

  it.each([
    ['an empty name', { name: '   ' }, /required/],
    ['a name that is too long', { name: 'x'.repeat(SKILL_NAME_MAX_LENGTH + 1) }, /100/],
    ['a name with HTML', { name: '<b>React</b>' }, /HTML/],
    ['notes that are too long', { notes: 'x'.repeat(SKILL_NOTES_MAX_LENGTH + 1) }, /500/],
    ['an unknown level', { level: 'guru' as never }, /level/],
    ['an unknown section', { category: 'hobby' as never }, /section/],
    ['notes that are not text', { notes: 42 as never }, /text/],
  ])('rejects %s without writing', async (_label, overrides, message) => {
    const { storage, flush } = createStorage();

    await expect(createSkill(ALEX.id, input(overrides), storage)).rejects.toThrow(message);

    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects a name that is not a string', async () => {
    const { storage } = createStorage();

    await expect(createSkill(ALEX.id, input({ name: 7 as never }), storage)).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects a person who is not on the team', async () => {
    const { storage } = createStorage();

    await expect(createSkill('ghost', input(), storage)).rejects.toThrow(ValidationError);
  });

  it('rejects a case-insensitive duplicate in the same section for the same person', async () => {
    const { storage } = createStorage();
    await createSkill(ALEX.id, input({ name: 'React' }), storage);

    await expect(createSkill(ALEX.id, input({ name: 'react' }), storage)).rejects.toThrow(
      /already has a skill/,
    );
  });

  it('allows the same skill in the other section, or for another person', async () => {
    const { storage } = createStorage();
    await createSkill(ALEX.id, input({ name: 'React' }), storage);

    await createSkill(ALEX.id, input({ name: 'React', category: 'growth' }), storage);
    await createSkill(PRIYA.id, input({ name: 'React' }), storage);

    expect(getAllSkills(storage)).toHaveLength(3);
  });

  it('rolls back and rethrows when the encrypted write fails', async () => {
    const failure = new StorageWriteError(true, true);
    const { storage, data } = createStorage({}, failure);

    await expect(createSkill(ALEX.id, input(), storage)).rejects.toBe(failure);

    expect(data.get('skills')).toEqual([]);
  });

  it('still rejects with the write failure when storage locked during the rollback', async () => {
    const failure = new StorageWriteError(true, true);
    const { storage } = createStorage({}, failure);
    let calls = 0;
    storage.setPrivate = () => {
      calls += 1;
      if (calls > 1) throw new Error('locked');
    };

    await expect(createSkill(ALEX.id, input(), storage)).rejects.toBe(failure);
  });
});

describe('updateSkill', () => {
  it('changes the editable fields, keeps identity and refreshes updatedAt', async () => {
    const { storage } = createStorage();
    const created = await createSkill(ALEX.id, input(), storage);
    await new Promise((resolve) => setTimeout(resolve, 2));

    const updated = await updateSkill(
      created.id,
      { name: 'Rust', level: 'expert', category: 'growth', notes: '' },
      storage,
    );

    expect(updated).toMatchObject({
      id: created.id,
      memberId: ALEX.id,
      name: 'Rust',
      level: 'expert',
      category: 'growth',
      notes: '',
      createdAt: created.createdAt,
    });
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it('leaves fields that are not in the update alone', async () => {
    const { storage } = createStorage();
    const created = await createSkill(ALEX.id, input(), storage);

    const updated = await updateSkill(created.id, { level: 'expert' }, storage);

    expect(updated).toMatchObject({ name: 'TypeScript', notes: 'Owns the type system' });
  });

  it('lets a skill keep its own name but not take another skill’s name', async () => {
    const { storage } = createStorage();
    const react = await createSkill(ALEX.id, input({ name: 'React' }), storage);
    await createSkill(ALEX.id, input({ name: 'Go' }), storage);

    await expect(updateSkill(react.id, { name: 'REACT' }, storage)).resolves.toMatchObject({
      name: 'REACT',
    });
    await expect(updateSkill(react.id, { name: 'go' }, storage)).rejects.toThrow(
      /already has a skill/,
    );
  });

  it('throws NotFoundError for an unknown id', async () => {
    const { storage } = createStorage();

    await expect(updateSkill('missing', { name: 'x' }, storage)).rejects.toThrow(NotFoundError);
  });

  it('restores the previous value when the write fails', async () => {
    const { storage, data, flush } = createStorage();
    const created = await createSkill(ALEX.id, input(), storage);
    flush.mockResolvedValueOnce(new StorageWriteError(true, true));

    await expect(updateSkill(created.id, { name: 'Rust' }, storage)).rejects.toThrow();

    expect(data.get('skills')).toEqual([created]);
  });
});

describe('deleteSkill', () => {
  it('removes only that skill', async () => {
    const { storage } = createStorage();
    const react = await createSkill(ALEX.id, input({ name: 'React' }), storage);
    const go = await createSkill(ALEX.id, input({ name: 'Go' }), storage);

    await deleteSkill(react.id, storage);

    expect(getSkills(storage, ALEX.id)).toEqual([go]);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const { storage } = createStorage();

    await expect(deleteSkill('missing', storage)).rejects.toThrow(NotFoundError);
  });

  it('restores the skill when the write fails', async () => {
    const { storage, data, flush } = createStorage();
    const created = await createSkill(ALEX.id, input(), storage);
    flush.mockResolvedValueOnce(new StorageWriteError(true, true));

    await expect(deleteSkill(created.id, storage)).rejects.toThrow();

    expect(data.get('skills')).toEqual([created]);
  });
});

describe('reading skills', () => {
  it('returns one person’s skills in the order they were added, as copies', async () => {
    const first = buildSkill({ memberId: ALEX.id, name: 'First' });
    const other = buildSkill({ memberId: PRIYA.id, name: 'Other' });
    const second = buildSkill({ memberId: ALEX.id, name: 'Second' });
    const { storage, data } = createStorage({ skills: [first, other, second] });

    const skills = getSkills(storage, ALEX.id);
    skills[0].name = 'mutated';

    expect(skills.map((skill) => skill.name)).toEqual(['mutated', 'Second']);
    expect((data.get('skills') as { name: string }[])[0].name).toBe('First');
  });

  it('returns nothing when the envelope has no skills or the value is not a list', () => {
    expect(getAllSkills(createStorage().storage)).toEqual([]);
    expect(getAllSkills(createStorage({ skills: 'nope' }).storage)).toEqual([]);
  });

  it('skips malformed records and warns once per id without echoing content', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const good = buildSkill({ memberId: ALEX.id });
    const bad = { id: 'bad-skill-1', memberId: ALEX.id, name: 'secret text', level: 'wizard' };
    const { storage } = createStorage({ skills: [good, bad, null, bad] });

    expect(getAllSkills(storage)).toEqual([good]);
    getAllSkills(storage);

    expect(warn).toHaveBeenCalledWith('Failed to parse skill bad-skill-1');
    expect(warn).toHaveBeenCalledWith('Failed to parse skill unknown');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret text');
  });
});

describe('deleteSkillsForMember', () => {
  it('removes every skill for that person and keeps the rest', async () => {
    const keep = buildSkill({ memberId: PRIYA.id });
    const { storage } = createStorage({
      skills: [buildSkill({ memberId: ALEX.id }), keep, buildSkill({ memberId: ALEX.id })],
    });

    await deleteSkillsForMember(ALEX.id, storage);

    expect(getAllSkills(storage)).toEqual([keep]);
  });
});

describe('guards', () => {
  it('recognises valid levels and sections only', () => {
    expect(isProficiencyLevel('expert')).toBe(true);
    expect(isProficiencyLevel('guru')).toBe(false);
    expect(isProficiencyLevel(3)).toBe(false);
    expect(isSkillCategory('growth')).toBe(true);
    expect(isSkillCategory('other')).toBe(false);
  });
});

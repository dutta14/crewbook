import { describe, expect, it } from 'vitest';
import {
  createActionItem,
  createConnection,
  createDecision,
  createDocumentLink,
  createFeedback,
  createFollowUp,
  createGrowthEntry,
  createLeave,
  createMember,
  createMoodEntry,
  createNote,
  createReminder,
  createSkill,
  createTodo,
} from '../test-utils/factories';
import {
  BACKUP_VERSION,
  createBackup,
  parseBackup,
  summarizeBackup,
  summarizePrivateData,
  toBackupJson,
  validateBackupSchema,
  type DataSnapshot,
} from './backupSchema';
import { BackupValidationError } from './schemaCheck';
import { ENVELOPE_KEYS, keysOf } from '../data/envelopeSchema';

const NOW = new Date('2025-06-01T10:00:00.000Z');

function fullSnapshot(): DataSnapshot {
  const lead = createMember({ id: 'lead-1', name: 'Priya Rao' });
  const report = createMember({ id: 'report-1', name: 'Sam Lee', manager: 'lead-1' });
  const memberId = report.id;
  return {
    main: {
      members: [lead, report],
      settings: {
        moodTrackingEnabled: 'true',
        managerName: 'Jo',
        reminderLeadTimes: JSON.stringify({
          visa_expiry: 30,
          probation_end: 14,
          anniversary: 7,
          birthday: 3,
        }),
        unknownSetting: 'dropped',
      },
      sharedNotes: [createNote({ id: 'shared-1', memberId, visibility: 'shared' })],
      shareTokens: [
        {
          id: 'token-1',
          engineerId: memberId,
          createdAt: NOW.toISOString(),
          expiresAt: '2025-06-02T10:00:00.000Z',
          revoked: false,
          ttl: '24h',
        },
      ],
      customFieldDefinitions: [
        { id: 'field-1', name: 'Team', type: 'select', options: ['A', 'B'], order: 0 },
      ],
    },
    private: {
      notes: [createNote({ id: 'note-1', memberId })],
      noteDrafts: { [memberId]: 'half written thought' },
      actionItems: [createActionItem({ id: 'action-1', memberId })],
      moods: [createMoodEntry({ id: 'mood-1', memberId })],
      decisions: [createDecision({ id: 'decision-1', engineerId: memberId })],
      followUps: [createFollowUp({ id: 'followup-1', engineerId: memberId })],
      todos: [createTodo({ id: 'todo-1', linkedPersonId: memberId })],
      reminders: [createReminder({ id: 'reminder-1', linkedPersonId: memberId })],
      dateEvents: [{ engineerId: memberId, type: 'birthday', date: '1990-04-02' }],
      leave: [createLeave({ id: 'leave-1', memberId })],
      growth: [createGrowthEntry({ id: 'growth-1', engineerId: memberId })],
      flightRisk: [
        {
          id: 'risk-1',
          engineerId: memberId,
          text: 'Mentioned an offer',
          flightRisk: 'high',
          createdAt: NOW.toISOString(),
        },
      ],
      feedback: [createFeedback({ id: 'fb-1', engineerId: memberId })],
      skills: [createSkill({ id: 'skill-1', memberId })],
      connections: [
        createConnection({ id: 'conn-1', sourceMemberId: lead.id, targetMemberId: memberId }),
      ],
      documentLinks: [createDocumentLink({ id: 'doc-1', memberId })],
      agendaItems: [
        {
          id: 'agenda-1',
          memberId,
          text: 'Career ladder',
          addedBy: 'manager',
          createdAt: NOW.toISOString(),
        },
      ],
    },
  };
}

function flatBackup(): Record<string, unknown> {
  return JSON.parse(toBackupJson(createBackup(fullSnapshot(), NOW))) as Record<string, unknown>;
}

const expectRejected = (raw: unknown, message?: RegExp) => {
  const run = () => validateBackupSchema(raw);
  expect(run).toThrow(BackupValidationError);
  if (message) expect(run).toThrow(message);
};

describe('createBackup', () => {
  it('writes every registered key, so no store is left out of a backup', () => {
    const flat = flatBackup();

    for (const key of ENVELOPE_KEYS) expect(flat, key).toHaveProperty(key);
    expect(flat.version).toBe(BACKUP_VERSION);
    expect(flat.exportedAt).toBe(NOW.toISOString());
    expect(flat.privateDataIncluded).toBe(true);
  });

  it('drops settings that are not on the allowed list', () => {
    const settings = flatBackup().settings as Record<string, string>;

    expect(settings.unknownSetting).toBeUndefined();
    expect(settings.managerName).toBe('Jo');
    expect(settings.reminderLeadTimes).toBeDefined();
  });

  it('leaves private data out when the private envelope could not be read', () => {
    const snapshot = { ...fullSnapshot(), private: null };

    const backup = createBackup(snapshot, NOW);
    const flat = JSON.parse(toBackupJson(backup)) as Record<string, unknown>;

    expect(backup.privateDataIncluded).toBe(false);
    for (const key of keysOf('private')) expect(flat).not.toHaveProperty(key);
    expect(flat).toHaveProperty('members');
  });

  it('refuses to write data it would not accept back', () => {
    const snapshot = fullSnapshot();
    snapshot.main.members = [{ ...(snapshot.main.members as object[])[0], role: 7 }];

    expect(() => createBackup(snapshot, NOW)).toThrow(BackupValidationError);
  });
});

describe('export then import', () => {
  it('returns exactly the data that went in', () => {
    const snapshot = fullSnapshot();
    const backup = createBackup(snapshot, NOW);

    const restored = parseBackup(toBackupJson(backup));

    expect(restored.main.members).toEqual(snapshot.main.members);
    expect(restored.main.sharedNotes).toEqual(snapshot.main.sharedNotes);
    expect(restored.main.shareTokens).toEqual(snapshot.main.shareTokens);
    expect(restored.main.customFieldDefinitions).toEqual(snapshot.main.customFieldDefinitions);
    for (const key of keysOf('private')) {
      expect(restored.private[key], key).toEqual(snapshot.private?.[key]);
    }
  });

  it('keeps custom field values on members', () => {
    const snapshot = fullSnapshot();
    snapshot.main.members = [createMember({ id: 'm', customFields: { 'field-1': 'A' } })];
    snapshot.private = {};

    const restored = parseBackup(toBackupJson(createBackup(snapshot, NOW)));

    expect((restored.main.members as { customFields: object }[])[0].customFields).toEqual({
      'field-1': 'A',
    });
  });
});

describe('validateBackupSchema: structure', () => {
  it.each([null, 'text', 12, [], undefined])('rejects %j as a backup', (raw) => {
    expectRejected(raw);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('not json')).toThrow(BackupValidationError);
  });

  it('rejects a top-level key it does not know', () => {
    expectRejected({ ...flatBackup(), extra: [] }, /unexpected field/);
  });

  it.each(['version', 'exportedAt', 'privateDataIncluded', 'members'])(
    'rejects a backup with no %s',
    (key) => {
      const raw = flatBackup();
      delete raw[key];

      expectRejected(raw, new RegExp(key));
    },
  );

  it('treats collections that are missing as empty', () => {
    const restored = validateBackupSchema({
      version: 1,
      exportedAt: NOW.toISOString(),
      privateDataIncluded: true,
      members: [],
    });

    expect(restored.main.sharedNotes).toEqual([]);
    expect(restored.main.settings).toEqual({});
    expect(restored.private.notes).toEqual([]);
    expect(restored.private.noteDrafts).toEqual({});
  });

  it('accepts a backup of the current version', () => {
    expect(validateBackupSchema(flatBackup()).version).toBe(BACKUP_VERSION);
  });

  it('tells the person to update when the backup is from a newer version', () => {
    expectRejected({ ...flatBackup(), version: BACKUP_VERSION + 1 }, /newer version/);
  });

  it.each([0, -1, 1.5, '1', null])('rejects version %j', (version) => {
    expectRejected({ ...flatBackup(), version });
  });

  it.each(['yesterday', '2025-13-40', 5, null])('rejects exportedAt %j', (exportedAt) => {
    expectRejected({ ...flatBackup(), exportedAt });
  });

  it('rejects a backup that says it has no private data but contains some', () => {
    expectRejected({ ...flatBackup(), privateDataIncluded: false }, /no private data/);
  });

  it('accepts a members-only backup that says it has no private data', () => {
    const raw = JSON.parse(
      toBackupJson(createBackup({ ...fullSnapshot(), private: null }, NOW)),
    ) as unknown;

    expect(validateBackupSchema(raw).privateDataIncluded).toBe(false);
  });
});

describe('validateBackupSchema: hostile input', () => {
  it.each(['__proto__', 'constructor', 'prototype'])('rejects a %s key at the top level', (key) => {
    const text = `{"version":1,"exportedAt":"${NOW.toISOString()}","privateDataIncluded":true,"members":[],"${key}":{}}`;

    expect(() => parseBackup(text)).toThrow(BackupValidationError);
  });

  it('rejects a __proto__ key nested inside a record', () => {
    const member = JSON.stringify(createMember()).replace(/^\{/, '{"__proto__":{"polluted":true},');
    const text = `{"version":1,"exportedAt":"${NOW.toISOString()}","privateDataIncluded":true,"members":[${member}]}`;

    expect(() => parseBackup(text)).toThrow(BackupValidationError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects a __proto__ key inside a dictionary', () => {
    const text = `{"version":1,"exportedAt":"${NOW.toISOString()}","privateDataIncluded":true,"members":[],"noteDrafts":{"__proto__":"x"}}`;

    expect(() => parseBackup(text)).toThrow(BackupValidationError);
  });

  it('rejects a field a record does not define', () => {
    const raw = flatBackup();
    raw.members = [{ ...(raw.members as object[])[0], isAdmin: true }];

    expectRejected(raw);
  });

  it('rejects a record with a required field missing', () => {
    const raw = flatBackup();
    const rest: Record<string, unknown> = { ...(raw.members as Record<string, unknown>[])[0] };
    delete rest.name;
    raw.members = [rest];

    expectRejected(raw);
  });

  it('rejects values of the wrong type', () => {
    const raw = flatBackup();
    raw.todos = 'not a list';

    expectRejected(raw);
  });

  it('rejects markup in a member field', () => {
    const raw = flatBackup();
    raw.members = [{ ...(raw.members as object[])[0], name: '<img src=x onerror=alert(1)>' }];

    expectRejected(raw);
  });

  it('rejects control characters in a member field', () => {
    const raw = flatBackup();
    raw.members = [{ ...(raw.members as object[])[0], role: 'Engineer\u0000' }];

    expectRejected(raw);
  });

  it('rejects markup in a custom field name', () => {
    const raw = flatBackup();
    raw.customFieldDefinitions = [{ id: 'field-1', name: '<b>x</b>', type: 'text', order: 0 }];

    expectRejected(raw);
  });

  it('rejects dates that do not exist', () => {
    const raw = flatBackup();
    raw.dateEvents = [{ engineerId: 'report-1', type: 'birthday', date: '2024-02-31' }];

    expectRejected(raw);
  });

  it('rejects more members than the app allows', () => {
    const raw = flatBackup();
    raw.members = Array.from({ length: 501 }, (_, index) =>
      createMember({ id: `member-${index}`, name: `Person ${index}` }),
    );

    expectRejected(raw);
  });

  it('never repeats a rejected value in its message', () => {
    const raw = flatBackup();
    raw.members = [{ ...(raw.members as object[])[0], role: 'SECRET-VALUE\u0000' }];

    try {
      validateBackupSchema(raw);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('SECRET-VALUE');
      expect((error as Error).message).toContain('role');
    }
  });
});

describe('validateBackupSchema: references', () => {
  it('rejects two records that share an id in one collection', () => {
    const raw = flatBackup();
    const [first] = raw.todos as object[];
    raw.todos = [first, first];

    expectRejected(raw, /duplicate/i);
  });

  it('rejects a note id used in both private and shared notes', () => {
    const raw = flatBackup();
    const [note] = raw.notes as { id: string }[];
    const [shared] = raw.sharedNotes as object[];
    raw.sharedNotes = [{ ...shared, id: note.id }];

    expectRejected(raw);
  });

  it('rejects a manager who is not in the roster', () => {
    const raw = flatBackup();
    raw.members = [{ ...(raw.members as object[])[0], manager: 'ghost' }];

    expectRejected(raw);
  });

  it('rejects a reporting loop', () => {
    const raw = flatBackup();
    const [lead, report] = raw.members as object[];
    raw.members = [{ ...lead, manager: 'report-1' }, report];

    expectRejected(raw);
  });
});

describe('summaries', () => {
  it('always lists members, notes and action items, even at zero', () => {
    const backup = validateBackupSchema({
      version: 1,
      exportedAt: NOW.toISOString(),
      privateDataIncluded: true,
      members: [],
    });

    const ids = summarizeBackup(backup).counts.map((line) => line.id);

    expect(ids).toEqual(expect.arrayContaining(['members', 'notes', 'actionItems']));
  });

  it('counts both private and shared notes as notes', () => {
    const backup = createBackup(fullSnapshot(), NOW);

    const notes = summarizeBackup(backup).counts.find((line) => line.id === 'notes');

    expect(notes?.count).toBe(2);
  });

  it('describes only private records in the export warning', () => {
    const lines = summarizePrivateData(fullSnapshot());

    expect(lines.map((line) => line.id)).not.toContain('members');
    expect(lines.find((line) => line.id === 'moods')?.count).toBe(1);
  });

  it('reports nothing private when the private envelope is unavailable', () => {
    expect(summarizePrivateData({ ...fullSnapshot(), private: null })).toEqual([]);
  });
});

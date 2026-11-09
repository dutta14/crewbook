import { describe, expect, it } from 'vitest';
import {
  COUNT_GROUPS,
  ENVELOPE_ENTRIES,
  ENVELOPE_KEYS,
  SETTING_KEYS,
  countRecords,
  getEnvelopeEntry,
  keysOf,
} from './envelopeSchema';

const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.*', '!../e2e/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const CALL =
  /storage\.(get|set|getPrivate|setPrivate)(?:<[^>(]*>)?\(\s*([A-Za-z_][A-Za-z0-9_]*|'[^']+')/g;

function constantValue(name: string, ownText: string, depth = 0): string | null {
  if (depth > 3) return null;
  const pattern = new RegExp(`const ${name}\\s*=\\s*('[^']+'|[A-Z_]+)`);
  const match =
    pattern.exec(ownText) ??
    Object.values(sources)
      .map((text) => pattern.exec(text))
      .find(Boolean);
  if (!match) return null;
  const value = match[1];
  return value.startsWith("'") ? value.slice(1, -1) : constantValue(value, ownText, depth + 1);
}

interface Usage {
  key: string;
  envelope: 'main' | 'private';
  file: string;
}

function findStorageUsage(): { usages: Usage[]; unresolved: string[] } {
  const usages: Usage[] = [];
  const unresolved: string[] = [];
  for (const [file, text] of Object.entries(sources)) {
    for (const match of text.matchAll(CALL)) {
      const [, method, ref] = match;
      const key = ref.startsWith("'")
        ? ref.slice(1, -1)
        : /^[A-Z_]+$/.test(ref)
          ? constantValue(ref, text)
          : null;
      if (key === null) {
        unresolved.push(`${file}: ${ref}`);
        continue;
      }
      usages.push({ key, envelope: method.endsWith('Private') ? 'private' : 'main', file });
    }
  }
  return { usages, unresolved };
}

describe('envelope registry', () => {
  it('lists every key the app reads or writes, in the envelope it uses', () => {
    const { usages } = findStorageUsage();

    expect(usages.length).toBeGreaterThan(20);
    for (const usage of usages) {
      const entry = getEnvelopeEntry(usage.key);
      expect(entry, `${usage.key} (${usage.file}) is missing from envelopeSchema.ts`).toBeDefined();
      expect(entry?.envelope, `${usage.key} (${usage.file})`).toBe(usage.envelope);
    }
  });

  it('has no entry that no code uses', () => {
    const used = new Set(findStorageUsage().usages.map((usage) => usage.key));

    for (const key of ENVELOPE_KEYS) expect(used.has(key), `${key} is never used`).toBe(true);
  });

  it('only leaves keys unresolved when a store writes through a parameter', () => {
    const { unresolved } = findStorageUsage();

    expect(unresolved.every((entry) => /customFields\.ts: key$/.test(entry))).toBe(true);
  });

  it('has one entry per key', () => {
    expect(new Set(ENVELOPE_KEYS).size).toBe(ENVELOPE_ENTRIES.length);
  });

  it('splits the keys between the main and private envelopes', () => {
    expect(keysOf('main')).toEqual(
      expect.arrayContaining(['members', 'settings', 'sharedNotes', 'customFieldDefinitions']),
    );
    expect(keysOf('private')).toEqual(
      expect.arrayContaining(['notes', 'moods', 'skills', 'documentLinks', 'flightRisk']),
    );
    expect(keysOf('main').some((key) => keysOf('private').includes(key))).toBe(false);
  });

  it('allows the lead times and last backup date among the settings', () => {
    expect(SETTING_KEYS).toEqual(expect.arrayContaining(['reminderLeadTimes', 'lastBackupAt']));
  });

  it('has a count group for every key whose records are counted', () => {
    const grouped = new Set(COUNT_GROUPS.flatMap((group) => group.keys));

    for (const entry of ENVELOPE_ENTRIES) {
      if (['settings', 'shareTokens'].includes(entry.key)) continue;
      expect(grouped.has(entry.key), entry.key).toBe(true);
    }
  });
});

describe('countRecords', () => {
  it('uses the singular label for one record and the plural otherwise', () => {
    const counts = countRecords({ todos: [{}], reminders: [{}, {}] }, true).filter(
      (line) => line.count > 0,
    );

    expect(counts).toEqual([
      { id: 'todos', count: 1, label: 'to-do' },
      { id: 'reminders', count: 2, label: 'reminders' },
    ]);
  });

  it('leaves out the main envelope when only private records are asked for', () => {
    const counts = countRecords({ members: [{}], notes: [{}] }, true).filter(
      (line) => line.count > 0,
    );

    expect(counts.map((line) => line.id)).toEqual(['notes']);
  });
});

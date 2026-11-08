import type { ActionItem, Decision, FollowUp, MoodEntry, Note, TeamMember } from '../types';

const now = () => new Date().toISOString();

export function createMember(overrides: Partial<TeamMember> = {}): TeamMember {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    name: 'Alex Chen',
    role: 'Software Engineer',
    level: 'L4',
    startDate: '2023-03-13T00:00:00.000Z',
    email: 'alex.chen@example.com',
    manager: null,
    status: 'active',
    customFields: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createNote(overrides: Partial<Note> = {}): Note {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    memberId: crypto.randomUUID(),
    content: 'Discussed the Q3 roadmap and growth goals.',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createActionItem(overrides: Partial<ActionItem> = {}): ActionItem {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    memberId: crypto.randomUUID(),
    title: 'Share the design doc draft',
    ownerId: 'manager',
    ownerName: 'Me',
    status: 'open',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createMoodEntry(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: crypto.randomUUID(),
    memberId: crypto.randomUUID(),
    noteId: crypto.randomUUID(),
    score: 4,
    recordedAt: now(),
    ...overrides,
  };
}

export function createDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: crypto.randomUUID(),
    engineerId: crypto.randomUUID(),
    title: 'Adopt new CI pipeline',
    context: 'Builds take 40 minutes today and the new pipeline cuts that in half.',
    date: '2025-01-15',
    linkedMeetingId: crypto.randomUUID(),
    linkedMeetingDate: '2025-01-15',
    createdAt: now(),
    ...overrides,
  };
}

export function createFollowUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    id: crypto.randomUUID(),
    engineerId: crypto.randomUUID(),
    title: 'Share the migration plan',
    ownerId: 'manager',
    ownerName: 'Me',
    dueDate: '2099-01-31',
    status: 'pending',
    linkedMeetingId: crypto.randomUUID(),
    linkedMeetingDate: '2025-01-15',
    createdAt: now(),
    ...overrides,
  };
}

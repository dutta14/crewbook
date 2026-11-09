import type {
  ActionItem,
  Connection,
  Decision,
  DocumentLink,
  FeedbackEntry,
  FollowUp,
  GrowthEntry,
  LeaveEntry,
  MoodEntry,
  Note,
  Reminder,
  Skill,
  TeamMember,
  Todo,
} from '../types';

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
    visibility: 'private',
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

export function createLeave(overrides: Partial<LeaveEntry> = {}): LeaveEntry {
  return {
    id: crypto.randomUUID(),
    memberId: crypto.randomUUID(),
    type: 'pto',
    startDate: '2026-06-15',
    endDate: '2026-06-15',
    createdAt: now(),
    ...overrides,
  };
}

export function createTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    title: 'Write the promo packet',
    priority: 'medium',
    status: 'todo',
    createdAt: now(),
    ...overrides,
  };
}

export function createGrowthEntry(overrides: Partial<GrowthEntry> = {}): GrowthEntry {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    engineerId: crypto.randomUUID(),
    date: '2025-03-03',
    changeType: 'promotion',
    from: 'L4',
    to: 'L5',
    notes: 'Led the payments migration.',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createSkill(overrides: Partial<Skill> = {}): Skill {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    memberId: crypto.randomUUID(),
    name: 'TypeScript',
    level: 'proficient',
    category: 'strength',
    notes: '',
    visibility: 'private',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createDocumentLink(overrides: Partial<DocumentLink> = {}): DocumentLink {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    memberId: crypto.randomUUID(),
    title: 'Q3 promo packet',
    url: 'https://docs.google.com/document/d/abc123',
    category: 'promo_packet',
    visibility: 'private',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: crypto.randomUUID(),
    sourceMemberId: crypto.randomUUID(),
    targetMemberId: crypto.randomUUID(),
    targetName: 'Priya Nair',
    relationship: 'collaborator',
    ...overrides,
  };
}

export function createFeedback(overrides: Partial<FeedbackEntry> = {}): FeedbackEntry {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    engineerId: crypto.randomUUID(),
    date: '2025-03-03',
    type: 'positive',
    text: 'Ran the incident review calmly and kept everyone on the timeline.',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function createReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: crypto.randomUUID(),
    text: 'Ask about the on-call rotation',
    linkedPersonId: crypto.randomUUID(),
    linkedPersonName: 'Alex Chen',
    triggerType: 'next_1on1',
    status: 'active',
    createdAt: now(),
    ...overrides,
  };
}

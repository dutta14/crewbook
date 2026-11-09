import type { SharedViewPayload } from '../types/sharing';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lifetime defaults to 24 hours: createdAt follows expiresAt unless a test sets both. */
export const makePayload = (overrides: Partial<SharedViewPayload> = {}): SharedViewPayload => {
  const expiresAt = overrides.expiresAt ?? '2026-01-09T10:00:00.000Z';
  return {
    v: 1,
    id: 'link-1',
    managerName: 'Morgan Lee',
    engineerName: 'Alice Park',
    engineerAvatar: { initials: 'AP', color: '#0f766e' },
    sharedNotes: [{ id: 'n1', text: 'Talked about the launch', createdAt: '2026-01-07T10:00:00Z' }],
    actionItems: [{ id: 'a1', title: 'Write the doc', status: 'open', owner: 'engineer' }],
    agendaItems: [],
    createdAt: new Date(Date.parse(expiresAt) - DAY_MS).toISOString(),
    ...overrides,
    expiresAt,
  };
};

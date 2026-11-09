import type { SharedViewPayload } from '../types/sharing';

export const makePayload = (overrides: Partial<SharedViewPayload> = {}): SharedViewPayload => ({
  v: 1,
  id: 'link-1',
  managerName: 'Morgan Lee',
  engineerName: 'Alice Park',
  engineerAvatar: { initials: 'AP', color: '#0f766e' },
  sharedNotes: [{ id: 'n1', text: 'Talked about the launch', createdAt: '2026-01-07T10:00:00Z' }],
  actionItems: [{ id: 'a1', title: 'Write the doc', status: 'open', owner: 'engineer' }],
  agendaItems: [],
  createdAt: '2026-01-08T10:00:00.000Z',
  expiresAt: '2026-01-09T10:00:00.000Z',
  ...overrides,
});

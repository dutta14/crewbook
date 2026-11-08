export type TeamMemberStatus = 'active' | 'on_leave' | 'departing' | 'new_hire';

// Minimal shape for test factories; the full data model and CRUD land with the data-model issue.
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  level: string;
  startDate: string;
  email: string;
  manager: string | null;
  status: TeamMemberStatus;
  avatarUrl?: string;
  customFields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

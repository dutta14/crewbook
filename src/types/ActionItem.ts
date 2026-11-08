export type ActionItemStatus = 'open' | 'done';

export interface ActionItem {
  id: string;
  memberId: string;
  title: string;
  owner: 'manager' | 'report';
  dueDate: string | null;
  status: ActionItemStatus;
  createdAt: string;
}

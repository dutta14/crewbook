export type ActionItemStatus = 'open' | 'done' | 'cancelled';

export interface ActionItem {
  id: string;
  memberId: string;
  /** The 1:1 note it was created from, when there is one. */
  noteId?: string;
  title: string;
  /** `manager` for the person running the 1:1, otherwise the id of a team member. */
  ownerId: string;
  /** Display name taken from the team list when the item is created; never typed by the user. */
  ownerName: string;
  /** Calendar day, YYYY-MM-DD. */
  dueDate?: string;
  status: ActionItemStatus;
  /** Only `false` keeps an item out of a share link, so items from before this existed stay shared. */
  includeInShare?: boolean;
  createdAt: string;
  updatedAt: string;
}

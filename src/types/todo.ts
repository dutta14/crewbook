export type Priority = 'low' | 'medium' | 'high';
export type TodoStatus = 'todo' | 'in_progress' | 'done';
export type TodoSortField = 'dueDate' | 'priority' | 'createdAt';

/** A manager's own task. Titles and descriptions can be about performance, so they stay private. */
export interface Todo {
  id: string;
  title: string;
  description?: string;
  /** Calendar day, YYYY-MM-DD. */
  dueDate?: string;
  priority: Priority;
  status: TodoStatus;
  linkedPersonId?: string;
  /** Display name taken from the team list when the task is saved; never typed by the user. */
  linkedPersonName?: string;
  /** ISO 8601 */
  createdAt: string;
}

export interface TodoFilters {
  status?: TodoStatus;
  priority?: Priority;
  personId?: string;
}

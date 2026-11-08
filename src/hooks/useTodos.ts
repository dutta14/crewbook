import { useCallback, useMemo, useState } from 'react';
import {
  createTodo as createTodoRecord,
  deleteTodo as deleteTodoRecord,
  filterTodos,
  getTodos,
  sortTodos,
  toggleTodoStatus,
  updateTodo as updateTodoRecord,
  type TodoInput,
  type TodoUpdate,
} from '../data/todos';
import { ValidationError } from '../data/errors';
import type { Todo, TodoFilters, TodoSortField } from '../types/todo';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save your task. Try again.";
const UPDATE_FAILED = "Couldn't update that task. Try again.";
const DELETE_FAILED = "Couldn't delete that task. Try again.";

export interface UseTodos {
  /** Every task after filtering and sorting. */
  todos: Todo[];
  /** Every task, so callers can tell "nothing yet" from "nothing matches". */
  total: number;
  filters: TodoFilters;
  sortField: TodoSortField;
  setFilters: (filters: Partial<TodoFilters>) => void;
  setSortField: (field: TodoSortField) => void;
  /**
   * Every write waits for the encrypted store, so the screen only changes once it has landed.
   * A failed write rolls back and shows an error toast, then rejects so the caller can stand
   * down. A ValidationError rejects without a toast; the form reports it next to the field.
   */
  createTodo: (input: TodoInput) => Promise<void>;
  updateTodo: (id: string, updates: TodoUpdate) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
}

export function useTodos(): UseTodos {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  // Component state only; filters can reveal who a task is about, so they never reach the URL.
  const [filters, setFiltersState] = useState<TodoFilters>({});
  const [sortField, setSortField] = useState<TodoSortField>('dueDate');

  const all = useMemo(() => getTodos(storage), [storage]);
  const todos = useMemo(
    () => sortTodos(filterTodos(all, filters), sortField),
    [all, filters, sortField],
  );

  const setFilters = useCallback((next: Partial<TodoFilters>) => {
    setFiltersState((current) => {
      const merged = { ...current, ...next };
      // An unset filter means "all", so it is removed rather than kept as undefined.
      return Object.fromEntries(
        Object.entries(merged).filter(([, value]) => value !== undefined && value !== ''),
      ) as TodoFilters;
    });
  }, []);

  const run = useCallback(
    async (operation: () => Promise<unknown>, failure: string) => {
      try {
        await operation();
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(failure, 'error');
        throw error;
      }
    },
    [showToast],
  );

  const createTodo = useCallback(
    (input: TodoInput) => run(() => createTodoRecord(input, storage), SAVE_FAILED),
    [run, storage],
  );
  const updateTodo = useCallback(
    (id: string, updates: TodoUpdate) =>
      run(() => updateTodoRecord(id, updates, storage), SAVE_FAILED),
    [run, storage],
  );
  const deleteTodo = useCallback(
    (id: string) => run(() => deleteTodoRecord(id, storage), DELETE_FAILED),
    [run, storage],
  );
  const toggleStatus = useCallback(
    (id: string) => run(() => toggleTodoStatus(id, storage), UPDATE_FAILED),
    [run, storage],
  );

  return {
    todos,
    total: all.length,
    filters,
    sortField,
    setFilters,
    setSortField,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleStatus,
  };
}

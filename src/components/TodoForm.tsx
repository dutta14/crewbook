import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  isPriority,
  isTodoStatus,
  TODO_DESCRIPTION_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
  type TodoInput,
} from '../data/todos';
import { ValidationError } from '../data/errors';
import type { TeamMember } from '../types/TeamMember';
import type { Priority, Todo, TodoStatus } from '../types/todo';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/pages/todo.css';
import { Avatar } from './Avatar';
import { FormField } from './FormField';
import { Modal } from './Modal';

export const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const STATUS_OPTIONS: Array<{ value: TodoStatus; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

export interface TodoFormProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saves the task. Rejects when it could not be saved; a ValidationError is shown in the form. */
  onSubmit: (input: Required<TodoInput>) => Promise<void>;
  members: TeamMember[];
  /** When provided the form is pre-filled and the task is edited instead of created. */
  todo?: Todo;
}

/** Every field is text so the form can start empty and still round-trip an unset value. */
interface FormValues {
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  status: TodoStatus;
  linkedPersonId: string;
}

const initialValues = (todo: Todo | undefined, members: TeamMember[]): FormValues => ({
  title: todo?.title ?? '',
  description: todo?.description ?? '',
  dueDate: todo?.dueDate ?? '',
  priority: todo?.priority ?? 'medium',
  status: todo?.status ?? 'todo',
  linkedPersonId: members.some((member) => member.id === todo?.linkedPersonId)
    ? (todo?.linkedPersonId ?? '')
    : '',
});

export function TodoForm({ isOpen, onClose, onSubmit, members, todo }: TodoFormProps) {
  // The dialog stays mounted briefly while it animates out. Each opening gets a fresh form, and
  // once it is gone nothing typed here (the description especially) is left in the DOM or state.
  const [openCount, setOpenCount] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setOpenCount((count) => count + 1);
  }
  const formId = useId();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={todo ? 'Edit task' : 'Add task'}
      size="md"
      mobileSheet
      footer={<FormFooter formId={formId} onCancel={onClose} />}
    >
      <TodoFormBody
        key={openCount}
        formId={formId}
        todo={todo}
        members={members}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    </Modal>
  );
}

function FormFooter({ formId, onCancel }: { formId: string; onCancel: () => void }) {
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" form={formId} className="btn btn-primary">
        Save
      </button>
    </>
  );
}

interface TodoFormBodyProps extends Pick<TodoFormProps, 'onSubmit' | 'members' | 'todo'> {
  formId: string;
  onClose: () => void;
}

function TodoFormBody({ formId, todo, members, onSubmit, onClose }: TodoFormBodyProps) {
  const prefix = useId();
  const [values, setValues] = useState(() => initialValues(todo, members));
  const [titleError, setTitleError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const ids = {
    title: `${prefix}-title`,
    description: `${prefix}-description`,
    dueDate: `${prefix}-due-date`,
    priority: `${prefix}-priority`,
    status: `${prefix}-status`,
    person: `${prefix}-person`,
  };
  const linkedPerson = members.find((member) => member.id === values.linkedPersonId);

  const handleText =
    (field: 'title' | 'description' | 'dueDate' | 'linkedPersonId') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      if (field === 'title') setTitleError('');
    };

  const handlePriority = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isPriority(value)) setValues((current) => ({ ...current, priority: value }));
  };

  const handleStatus = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isTodoStatus(value)) setValues((current) => ({ ...current, status: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    if (values.title.trim() === '') {
      setTitleError('Enter a title for this task');
      titleRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      // The data layer re-validates; its messages never include task content. Anything else has
      // already been reported with a toast.
      if (error instanceof ValidationError) setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      id={formId}
      className="member-form"
      noValidate
      autoComplete="off"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
    >
      <FormField id={ids.title} label="Title" required error={titleError}>
        <input
          ref={titleRef}
          id={ids.title}
          type="text"
          className="form-input"
          autoComplete="off"
          aria-required="true"
          maxLength={TODO_TITLE_MAX_LENGTH}
          value={values.title}
          onChange={handleText('title')}
          {...(titleError
            ? { 'aria-invalid': true as const, 'aria-describedby': `${ids.title}-error` }
            : {})}
        />
      </FormField>
      <FormField id={ids.description} label="Description">
        <textarea
          id={ids.description}
          className="form-input todo-form__description"
          autoComplete="off"
          rows={4}
          maxLength={TODO_DESCRIPTION_MAX_LENGTH}
          value={values.description}
          onChange={handleText('description')}
        />
      </FormField>
      <FormField id={ids.dueDate} label="Due date">
        <input
          id={ids.dueDate}
          type="date"
          className="form-input"
          autoComplete="off"
          value={values.dueDate}
          onChange={handleText('dueDate')}
        />
      </FormField>
      <div className="todo-form__pair">
        <FormField id={ids.priority} label="Priority">
          <select
            id={ids.priority}
            className="form-input"
            autoComplete="off"
            value={values.priority}
            onChange={handlePriority}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={ids.status} label="Status">
          <select
            id={ids.status}
            className="form-input"
            autoComplete="off"
            value={values.status}
            onChange={handleStatus}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField id={ids.person} label="Linked person">
        <div className="todo-form__person">
          {linkedPerson ? (
            <Avatar
              name={linkedPerson.name}
              avatarUrl={linkedPerson.avatarUrl}
              size="sm"
              aria-hidden
            />
          ) : null}
          <select
            id={ids.person}
            className="form-input"
            autoComplete="off"
            value={values.linkedPersonId}
            onChange={handleText('linkedPersonId')}
          >
            <option value="">No one</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </FormField>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
    </form>
  );
}

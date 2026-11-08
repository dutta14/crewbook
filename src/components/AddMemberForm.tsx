import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { addMember, isTeamMemberStatus, updateMember } from '../data/members';
import { ValidationError } from '../data/errors';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import type { TeamMember, TeamMemberInput, TeamMemberStatus } from '../types/TeamMember';
import { toDateAttribute } from '../utils/startDate';
import {
  FORM_LIMITS,
  stripHtml,
  toDateInputValue,
  validateForm,
  type FormErrors,
} from '../utils/validateMemberForm';
import '../styles/button.css';
import '../styles/form.css';
import { FormField } from './FormField';

const STATUS_OPTIONS: Array<{ value: TeamMemberStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'departing', label: 'Departing' },
  { value: 'new_hire', label: 'New Hire' },
];

interface FormValues {
  name: string;
  role: string;
  level: string;
  startDate: string;
  email: string;
  manager: string;
  status: TeamMemberStatus;
  departureDate: string;
}

const initialValues = (editMember?: TeamMember): FormValues =>
  editMember
    ? {
        name: editMember.name,
        role: editMember.role,
        level: editMember.level,
        startDate: toDateAttribute(editMember.startDate),
        email: editMember.email,
        manager: editMember.manager ?? '',
        status: editMember.status,
        departureDate: editMember.departureDate ?? '',
      }
    : {
        name: '',
        role: '',
        level: '',
        startDate: toDateInputValue(new Date()),
        email: '',
        manager: '',
        status: 'active',
        departureDate: '',
      };

export interface AddMemberFormProps {
  members: TeamMember[];
  editMember?: TeamMember;
  onClose: () => void;
  onSuccess: (member: TeamMember) => void;
}

export function AddMemberForm({ members, editMember, onClose, onSuccess }: AddMemberFormProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const prefix = useId();
  const [values, setValues] = useState(() => initialValues(editMember));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const departureDateRef = useRef<HTMLInputElement>(null);

  const ids = {
    name: `${prefix}-name`,
    role: `${prefix}-role`,
    level: `${prefix}-level`,
    startDate: `${prefix}-start-date`,
    email: `${prefix}-email`,
    manager: `${prefix}-manager`,
    status: `${prefix}-status`,
    departureDate: `${prefix}-departure-date`,
  };
  const errorProps = (field: keyof FormErrors) =>
    errors[field]
      ? { 'aria-invalid': true as const, 'aria-describedby': `${ids[field]}-error` }
      : {};

  const handleText =
    (field: 'name' | 'role' | 'level' | 'startDate' | 'email' | 'manager' | 'departureDate') =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
    };

  const handleStatus = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isTeamMemberStatus(value)) setValues((current) => ({ ...current, status: value }));
  };

  const isDeparting = values.status === 'departing';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const departureDate = isDeparting ? values.departureDate.trim() : '';
    const nextErrors = validateForm(
      { ...values, departureDate },
      { originalStartDate: editMember ? initialValues(editMember).startDate : undefined },
    );
    setErrors(nextErrors);
    const firstInvalid = (['name', 'startDate', 'departureDate', 'email'] as const).find(
      (field) => nextErrors[field],
    );
    if (firstInvalid) {
      (
        ({
          name: nameRef,
          startDate: startDateRef,
          departureDate: departureDateRef,
          email: emailRef,
        }) as const
      )[firstInvalid].current?.focus();
      return;
    }

    const input: TeamMemberInput = {
      name: stripHtml(values.name),
      role: stripHtml(values.role),
      level: stripHtml(values.level),
      startDate: values.startDate.trim() || toDateInputValue(new Date()),
      email: values.email.trim(),
      manager: values.manager || null,
      status: values.status,
      // Always present so an edit that stops being "departing" clears the stored date.
      departureDate: departureDate || undefined,
      customFields: editMember?.customFields ?? {},
    };

    setIsSubmitting(true);
    try {
      const saved = editMember
        ? await updateMember(editMember.id, input, storage)
        : await addMember(input, storage);
      setValues(initialValues(editMember));
      setErrors({});
      onSuccess(saved);
      onClose();
    } catch (error) {
      // The data layer re-validates; its messages never include member data.
      showToast(
        error instanceof ValidationError ? error.message : 'Failed to save. Try again.',
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const managers = members.filter((member) => member.id !== editMember?.id);

  return (
    <form
      className="member-form"
      noValidate
      autoComplete="off"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
    >
      <FormField id={ids.name} label="Name" required error={errors.name}>
        <input
          ref={nameRef}
          id={ids.name}
          type="text"
          className="form-input"
          autoComplete="off"
          aria-required="true"
          value={values.name}
          onChange={handleText('name')}
          {...errorProps('name')}
        />
      </FormField>
      <FormField id={ids.role} label="Role">
        <input
          id={ids.role}
          type="text"
          className="form-input"
          autoComplete="off"
          maxLength={FORM_LIMITS.shortText}
          value={values.role}
          onChange={handleText('role')}
        />
      </FormField>
      <FormField id={ids.level} label="Level">
        <input
          id={ids.level}
          type="text"
          className="form-input"
          autoComplete="off"
          maxLength={FORM_LIMITS.shortText}
          value={values.level}
          onChange={handleText('level')}
        />
      </FormField>
      <FormField id={ids.startDate} label="Start date" error={errors.startDate}>
        <input
          ref={startDateRef}
          id={ids.startDate}
          type="date"
          className="form-input"
          autoComplete="off"
          value={values.startDate}
          onChange={handleText('startDate')}
          {...errorProps('startDate')}
        />
      </FormField>
      <FormField id={ids.email} label="Email" error={errors.email}>
        <input
          ref={emailRef}
          id={ids.email}
          type="email"
          className="form-input"
          autoComplete="off"
          value={values.email}
          onChange={handleText('email')}
          {...errorProps('email')}
        />
      </FormField>
      <FormField id={ids.manager} label="Manager">
        <select
          id={ids.manager}
          className="form-input"
          autoComplete="off"
          value={values.manager}
          onChange={handleText('manager')}
        >
          <option value="">None</option>
          {managers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
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
      {isDeparting ? (
        <FormField
          id={ids.departureDate}
          label="Expected departure date"
          error={errors.departureDate}
        >
          <input
            ref={departureDateRef}
            id={ids.departureDate}
            type="date"
            className="form-input"
            autoComplete="off"
            value={values.departureDate}
            onChange={handleText('departureDate')}
            {...errorProps('departureDate')}
          />
        </FormField>
      ) : null}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" aria-disabled={isSubmitting}>
          {editMember ? 'Save changes' : 'Add Member'}
        </button>
      </div>
    </form>
  );
}

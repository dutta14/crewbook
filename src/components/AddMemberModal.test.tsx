import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as membersModule from '../data/members';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { TeamMember, TeamMemberInput } from '../types/TeamMember';
import { AddMemberModal } from './AddMemberModal';

vi.mock('../data/members', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/members')>();
  return {
    ...actual,
    addMember: vi.fn(actual.addMember),
    updateMember: vi.fn(actual.updateMember),
  };
});

const addMemberSpy = vi.mocked(membersModule.addMember);
const updateMemberSpy = vi.mocked(membersModule.updateMember);

const existing = (): TeamMember[] => [
  createMember({ id: 'm1', name: 'Alice Park' }),
  createMember({ id: 'm2', name: 'Bob Singh' }),
];

interface HarnessProps {
  members?: TeamMember[];
  editMember?: TeamMember;
  onSuccess?: (member: TeamMember) => void;
}

function Harness({ members = existing(), editMember, onSuccess = vi.fn() }: HarnessProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Add Member
      </button>
      <AddMemberModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={onSuccess}
        members={members}
        editMember={editMember}
      />
    </>
  );
}

async function openModal(props: HarnessProps = {}) {
  const user = userEvent.setup();
  const view = renderWithProviders(<Harness {...props} />);
  const trigger = screen.getByRole('button', { name: 'Add Member' });
  await user.click(trigger);
  return { user, trigger, ...view };
}

const nameInput = () => screen.getByLabelText(/^Name/);
const submit = () =>
  within(screen.getByRole('dialog')).getByRole('button', { name: /^(Add Member|Save changes)$/ });

beforeEach(() => {
  addMemberSpy.mockClear();
  updateMemberSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AddMemberModal', () => {
  it('modal opens when Add Member button is clicked', async () => {
    renderWithProviders(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Add Member' }));

    expect(screen.getByRole('dialog', { name: 'Add Team Member' })).toBeInTheDocument();
  });

  it('modal has role="dialog" and aria-modal="true"', async () => {
    await openModal();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Add Team Member');
  });

  it('modal closes on Cancel click', async () => {
    const { user } = await openModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
  });

  it('modal closes on Escape key from any field', async () => {
    const { user } = await openModal();
    await user.click(screen.getByRole('combobox', { name: 'Status' }));

    await user.keyboard('{Escape}');

    await vi.waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
  });

  it('modal closes on backdrop click', async () => {
    const { user } = await openModal();
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;

    await user.pointer({ keys: '[MouseLeft]', target: backdrop });

    await vi.waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
  });

  it('focus moves to first input (name) when modal opens', async () => {
    await openModal();

    expect(nameInput()).toHaveFocus();
  });

  it('focus returns to Add Member trigger button on close', async () => {
    const { user, trigger } = await openModal();

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(trigger).toHaveFocus();
  });

  it('Tab cycles within modal only (focus trap)', async () => {
    const { user } = await openModal();
    const dialog = screen.getByRole('dialog');

    for (let step = 0; step < 14; step += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('submitting with empty name shows validation error', async () => {
    const { user } = await openModal();

    await user.click(submit());

    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    expect(addMemberSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('submitting a name that is only HTML shows the name error', async () => {
    const { user } = await openModal();

    await user.type(nameInput(), '<b></b>');
    await user.click(submit());

    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
  });

  it('submitting with invalid email shows validation error', async () => {
    const { user } = await openModal();

    await user.type(nameInput(), 'Priya Sharma');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(submit());

    expect(screen.getByText('Enter an email like name@example.com.')).toBeInTheDocument();
    expect(addMemberSpy).not.toHaveBeenCalled();
  });

  it('submitting with start date in far past shows validation error', async () => {
    const { user } = await openModal();

    await user.type(nameInput(), 'Priya Sharma');
    await user.clear(screen.getByLabelText('Start date'));
    await user.type(screen.getByLabelText('Start date'), '2001-01-01');
    await user.click(submit());

    expect(screen.getByText('Start date can’t be more than a year ago.')).toBeInTheDocument();
    expect(addMemberSpy).not.toHaveBeenCalled();
  });

  it('invalid inputs have aria-invalid="true" and aria-describedby linking to error', async () => {
    const { user } = await openModal();
    await user.type(screen.getByLabelText('Email'), 'nope');

    await user.click(submit());

    for (const [field, message] of [
      [nameInput(), 'Enter a name.'],
      [screen.getByLabelText('Email'), 'Enter an email like name@example.com.'],
    ] as const) {
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(message);
    }
    expect(screen.getByLabelText('Role')).not.toHaveAttribute('aria-invalid');
  });

  it('on submit failure, focus moves to first invalid field', async () => {
    const { user } = await openModal();
    await user.type(screen.getByLabelText('Email'), 'nope');

    await user.click(submit());
    expect(nameInput()).toHaveFocus();

    await user.type(nameInput(), 'Priya');
    await user.click(submit());
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('successful submit calls addMember with correct data', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2025, 5, 10, 12) });
    const { user } = await openModal();

    await user.type(nameInput(), 'Priya Sharma');
    await user.type(screen.getByLabelText('Role'), 'Software Engineer');
    await user.type(screen.getByLabelText('Level'), 'L5');
    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.selectOptions(screen.getByLabelText('Manager'), 'Bob Singh');
    await user.selectOptions(screen.getByLabelText('Status'), 'New Hire');
    await user.click(submit());

    expect(addMemberSpy).toHaveBeenCalledTimes(1);
    const input: TeamMemberInput = addMemberSpy.mock.calls[0][0];
    expect(input).toEqual({
      name: 'Priya Sharma',
      role: 'Software Engineer',
      level: 'L5',
      startDate: '2025-06-10',
      email: 'priya@example.com',
      manager: 'm2',
      status: 'new_hire',
      customFields: {},
    });
  });

  it('strips HTML tags and surrounding whitespace before saving', async () => {
    const { user } = await openModal();

    await user.type(nameInput(), '  <b>Priya</b> Sharma ');
    await user.click(submit());

    expect(addMemberSpy.mock.calls[0][0].name).toBe('Priya Sharma');
  });

  it('successful submit closes modal and calls onSuccess with the saved member', async () => {
    const onSuccess = vi.fn();
    const { user } = await openModal({ onSuccess });

    await user.type(nameInput(), 'Priya Sharma');
    await user.click(submit());

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: 'Priya Sharma' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
  });

  it('form fields reset after successful submission', async () => {
    const { user } = await openModal();
    await user.type(nameInput(), 'Priya Sharma');
    await user.type(screen.getByLabelText('Role'), 'Engineer');
    await user.click(submit());
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(nameInput()).toHaveValue('');
    expect(screen.getByLabelText('Role')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('active');
  });

  it('discards unsaved input when the dialog is cancelled and reopened', async () => {
    const { user } = await openModal();
    await user.type(nameInput(), 'Draft Person');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(nameInput()).toHaveValue('');
    expect(addMemberSpy).not.toHaveBeenCalled();
  });

  it('manager dropdown lists existing team members', async () => {
    await openModal();

    const options = within(screen.getByLabelText('Manager')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'None',
      'Alice Park',
      'Bob Singh',
    ]);
    expect(screen.getByLabelText('Manager')).toHaveValue('');
  });

  it('manager dropdown shows only None when there are no members', async () => {
    await openModal({ members: [] });

    expect(within(screen.getByLabelText('Manager')).getAllByRole('option')).toHaveLength(1);
  });

  it('status defaults to Active and offers the four statuses', async () => {
    await openModal();

    const status = screen.getByLabelText('Status');
    expect(status).toHaveValue('active');
    expect(
      within(status)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Active', 'On Leave', 'Departing', 'New Hire']);
  });

  it('name input has aria-required="true" and every input opts out of autofill', async () => {
    await openModal();

    expect(nameInput()).toHaveAttribute('aria-required', 'true');
    for (const field of screen.getAllByRole('textbox')) {
      expect(field).toHaveAttribute('autocomplete', 'off');
    }
    expect(screen.getByRole('dialog').querySelector('form')).toHaveAttribute('novalidate');
  });

  it('Enter in a field submits the form', async () => {
    const { user } = await openModal();

    await user.type(nameInput(), 'Priya Sharma{Enter}');

    expect(addMemberSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open with the data intact and shows an error toast when saving fails', async () => {
    addMemberSpy.mockRejectedValueOnce(new Error('disk full'));
    const onSuccess = vi.fn();
    const { user } = await openModal({ onSuccess });

    await user.type(nameInput(), 'Priya Sharma');
    await user.click(submit());

    expect(await screen.findByText('Failed to save. Try again.')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Priya Sharma');
    expect(submit()).toHaveAttribute('aria-disabled', 'false');
  });

  it('marks the form busy and the submit button aria-disabled while saving', async () => {
    let finish: (member: TeamMember) => void = () => undefined;
    addMemberSpy.mockImplementationOnce(
      () => new Promise<TeamMember>((resolve) => (finish = resolve)),
    );
    const { user } = await openModal();
    await user.type(nameInput(), 'Priya Sharma');

    await user.click(submit());

    expect(submit()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('dialog').querySelector('form')).toHaveAttribute('aria-busy', 'true');
    await user.click(submit());
    expect(addMemberSpy).toHaveBeenCalledTimes(1);
    finish(createMember({ name: 'Priya Sharma' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
  });

  it('has no accessibility violations, including with validation errors showing', async () => {
    const { user } = await openModal();
    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();

    await user.click(submit());

    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
  });

  describe('editing', () => {
    const alice = () =>
      createMember({ id: 'm1', name: 'Alice Park', manager: null, startDate: '2023-03-13' });

    it('pre-fills the fields, retitles the dialog and saves through updateMember', async () => {
      const member = alice();
      const { user } = await openModal({
        members: [member, createMember({ id: 'm2', name: 'Bob' })],
        editMember: member,
      });

      expect(screen.getByRole('dialog', { name: 'Edit Team Member' })).toBeInTheDocument();
      expect(nameInput()).toHaveValue('Alice Park');
      expect(screen.getByLabelText('Start date')).toHaveValue('2023-03-13');
      await user.clear(nameInput());
      await user.type(nameInput(), 'Alice P. Park');
      await user.click(submit());

      expect(updateMemberSpy).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ name: 'Alice P. Park', startDate: '2023-03-13' }),
        expect.anything(),
      );
      expect(addMemberSpy).not.toHaveBeenCalled();
    });

    it('leaves the member out of their own manager dropdown', async () => {
      const member = alice();
      await openModal({
        members: [member, createMember({ id: 'm2', name: 'Bob' })],
        editMember: member,
      });

      const names = within(screen.getByLabelText('Manager'))
        .getAllByRole('option')
        .map((option) => option.textContent);
      expect(names).toEqual(['None', 'Bob']);
    });
  });
});

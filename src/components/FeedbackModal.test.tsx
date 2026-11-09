import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createFeedback, createMember } from '../test-utils/factories';
import { toIsoDate } from '../utils/scheduleCalculator';
import { FeedbackModal } from './FeedbackModal';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function renderModal(props: Partial<React.ComponentProps<typeof FeedbackModal>> = {}) {
  const onSubmit = vi.fn(async () => undefined);
  const onClose = vi.fn();
  render(
    <FeedbackModal
      isOpen
      onClose={onClose}
      onSubmit={onSubmit}
      members={[ALEX, PRIYA]}
      {...props}
    />,
  );
  return { onSubmit, onClose };
}

const person = () => screen.getByRole('combobox', { name: /Person/ });
const text = () => screen.getByRole('textbox', { name: /What did you observe/ });
const save = () => screen.getByRole('button', { name: 'Save feedback' });

describe('FeedbackModal', () => {
  it('opens as a dialog with the person, date, type, text and tags fields', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Log feedback' });
    expect(within(dialog).getByRole('combobox', { name: /Person/ })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Date/)).toHaveAttribute('type', 'date');
    expect(within(dialog).getByRole('radiogroup', { name: 'Feedback type' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Add tags' })).toBeInTheDocument();
  });

  it('defaults the date to today, forbids later dates and starts on neutral', () => {
    renderModal();

    const today = toIsoDate(new Date());
    expect(screen.getByLabelText(/^Date/)).toHaveValue(today);
    expect(screen.getByLabelText(/^Date/)).toHaveAttribute('max', today);
    expect(screen.getByRole('radio', { name: 'Neutral' })).toBeChecked();
  });

  it('pre-selects the person it was opened for', () => {
    renderModal({ defaultEngineerId: PRIYA.id });

    expect(person()).toHaveValue(PRIYA.id);
  });

  it('asks for a person and text before saving, and focuses the first problem', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.click(save());

    expect(screen.getByText('Choose a team member')).toBeInTheDocument();
    expect(screen.getByText('Write an observation before saving')).toBeInTheDocument();
    expect(person()).toHaveAttribute('aria-invalid', 'true');
    expect(person()).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a future date in the form', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal({ defaultEngineerId: ALEX.id });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: toIsoDate(tomorrow) } });
    await user.type(text(), 'Something');
    await user.click(save());

    expect(screen.getByText("Date can't be in the future")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the chosen values and closes', async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderModal({ defaultEngineerId: ALEX.id });

    await user.click(screen.getByRole('radio', { name: 'Positive' }));
    await user.type(text(), 'Ran the review well');
    await user.type(screen.getByRole('textbox', { name: 'Add tags' }), 'Leadership{Enter}');
    await user.click(save());

    expect(onSubmit).toHaveBeenCalledWith({
      engineerId: ALEX.id,
      date: toIsoDate(new Date()),
      type: 'positive',
      text: 'Ran the review well',
      tags: ['leadership'],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('moves between types with the arrow keys', async () => {
    const user = userEvent.setup();
    renderModal();

    screen.getByRole('radio', { name: 'Neutral' }).focus();
    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('radio', { name: 'Constructive' })).toBeChecked();
  });

  it('adds tags with Enter or a comma, and removes them', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByRole('textbox', { name: 'Add tags' });

    await user.type(input, 'demo,Mentoring{Enter}demo{Enter}');

    expect(screen.getByRole('button', { name: 'Remove tag: demo' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Remove tag/ })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Remove tag: demo' }));
    expect(screen.queryByRole('button', { name: 'Remove tag: demo' })).toBeNull();
  });

  it('does not submit the form when Enter adds a tag', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal({ defaultEngineerId: ALEX.id });

    await user.type(text(), 'Some words');
    await user.type(screen.getByRole('textbox', { name: 'Add tags' }), 'tag{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a tag with characters other than letters, numbers and hyphens', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByRole('textbox', { name: 'Add tags' }), '<b>{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('letters, numbers and hyphens');
    expect(screen.queryByRole('button', { name: /Remove tag/ })).toBeNull();
  });

  it('stops at ten tags', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByRole('textbox', { name: 'Add tags' });

    for (let index = 0; index < 11; index += 1) await user.type(input, `t${index}{Enter}`);

    expect(screen.getAllByRole('button', { name: /Remove tag/ })).toHaveLength(10);
    expect(input).toBeDisabled();
  });

  it('shows the data layer’s validation message without closing', async () => {
    const { ValidationError } = await import('../data/errors');
    const user = userEvent.setup();
    const { onClose } = renderModal({
      defaultEngineerId: ALEX.id,
      onSubmit: vi.fn(async () => {
        throw new ValidationError('Tags can use letters, numbers and hyphens only');
      }),
    });

    await user.type(text(), 'Words');
    await user.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent('Tags can use');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays open when saving fails for another reason', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({
      defaultEngineerId: ALEX.id,
      onSubmit: vi.fn(async () => {
        throw new Error('storage');
      }),
    });

    await user.type(text(), 'Words');
    await user.click(save());

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is pre-filled when editing', () => {
    renderModal({
      entry: createFeedback({
        engineerId: PRIYA.id,
        date: '2025-02-02',
        type: 'constructive',
        text: 'Interrupted a lot',
        tags: ['communication'],
      }),
    });

    expect(screen.getByRole('dialog', { name: 'Edit feedback' })).toBeInTheDocument();
    expect(person()).toHaveValue(PRIYA.id);
    expect(screen.getByLabelText(/^Date/)).toHaveValue('2025-02-02');
    expect(screen.getByRole('radio', { name: 'Constructive' })).toBeChecked();
    expect(text()).toHaveValue('Interrupted a lot');
    expect(screen.getByRole('button', { name: 'Remove tag: communication' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <FeedbackModal isOpen onClose={() => undefined} onSubmit={vi.fn()} members={[ALEX]} />,
    );

    expect(await axe(document.body || container)).toHaveNoViolations();
  });
});

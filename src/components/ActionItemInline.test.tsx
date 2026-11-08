import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { ACTION_ITEM_TITLE_MAX_LENGTH } from '../data/actionItems';
import { ActionItemInline, AddActionItem } from './ActionItemInline';

const ALEX = createMember({ id: '11111111-1111-4111-8111-111111111111', name: 'Alex Chen' });
const PRIYA = createMember({ id: '22222222-2222-4222-8222-222222222222', name: 'Priya Nair' });

const render = (ui: React.ReactElement) =>
  renderWithProviders(ui, {
    initialData: { members: [ALEX, PRIYA] },
    initialPrivateData: { actionItems: [] },
  });

const addButton = () => screen.getByRole('button', { name: '+ Action Item' });

describe('ActionItemInline', () => {
  it('creates action item with title, owner, and due date', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(
      <ActionItemInline
        memberId={ALEX.id}
        noteId="note-1"
        onCreated={onCreated}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Title'), 'Update oncall runbook');
    await user.selectOptions(screen.getByLabelText('Owner'), 'Priya Nair');
    await user.type(screen.getByLabelText('Due date (optional)'), '2030-04-05');
    await user.click(screen.getByRole('button', { name: 'Add action item' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(onCreated.mock.calls[0][0]).toMatchObject({
      memberId: ALEX.id,
      noteId: 'note-1',
      title: 'Update oncall runbook',
      ownerId: PRIYA.id,
      ownerName: 'Priya Nair',
      dueDate: '2030-04-05',
      status: 'open',
    });
  });

  it('offers only the manager and team members as owners', () => {
    render(<ActionItemInline memberId={ALEX.id} onCreated={vi.fn()} onCancel={vi.fn()} />);

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Me', 'Alex Chen', 'Priya Nair']);
    expect(screen.getByLabelText('Owner')).toHaveValue('manager');
  });

  it('rejects creation with empty title', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<ActionItemInline memberId={ALEX.id} onCreated={onCreated} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Title'), '   ');
    await user.click(screen.getByRole('button', { name: 'Add action item' }));

    const title = screen.getByLabelText('Title');
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a title');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('Enter a title for this action item');
    expect(title).toHaveFocus();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('clears the title error as soon as the user types', async () => {
    const user = userEvent.setup();
    render(<ActionItemInline memberId={ALEX.id} onCreated={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add action item' }));
    await user.type(screen.getByLabelText('Title'), 'a');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'false');
  });

  it('limits the title to the maximum length', () => {
    render(<ActionItemInline memberId={ALEX.id} onCreated={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('Title')).toHaveAttribute(
      'maxlength',
      String(ACTION_ITEM_TITLE_MAX_LENGTH),
    );
  });

  it('shows an error and stays open when the member no longer exists', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<ActionItemInline memberId="ghost" onCreated={onCreated} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Title'), 'Orphan{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Action item needs a team member');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('Enter submits the inline form', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<ActionItemInline memberId={ALEX.id} onCreated={onCreated} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Title'), 'Send the offer letter{Enter}');

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  });

  it('Escape cancels from any field', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ActionItemInline memberId={ALEX.id} onCreated={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByLabelText('Owner'));
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <ActionItemInline memberId={ALEX.id} onCreated={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AddActionItem', () => {
  it('focus moves to title input when "+Action Item" is clicked', async () => {
    const user = userEvent.setup();
    render(<AddActionItem memberId={ALEX.id} />);

    expect(addButton()).toHaveAttribute('aria-expanded', 'false');
    await user.click(addButton());

    expect(screen.getByLabelText('Title')).toHaveFocus();
    expect(addButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('Escape cancels and returns focus to "+Action Item" button', async () => {
    const user = userEvent.setup();
    render(<AddActionItem memberId={ALEX.id} />);

    await user.click(addButton());
    await user.keyboard('{Escape}');

    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(addButton()).toHaveFocus();
  });

  it('closes, returns focus and confirms after the item is created', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<AddActionItem memberId={ALEX.id} onCreated={onCreated} />);

    await user.click(addButton());
    await user.type(screen.getByLabelText('Title'), 'Share the doc{Enter}');

    await waitFor(() => expect(addButton()).toHaveFocus());
    expect(onCreated).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(screen.getByText('Action item added')).toBeInTheDocument();
  });
});

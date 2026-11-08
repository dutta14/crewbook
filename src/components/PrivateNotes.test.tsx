import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { PrivateNotes } from './PrivateNotes';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const SECTION = 'Private Notes (visible only to you)';

function Stored() {
  const { getPrivate } = useEncryptedStorage();
  return <output aria-label="Stored notes">{JSON.stringify(getPrivate('flightRisk'))}</output>;
}

const stored = (
  id: string,
  text: string,
  createdAt: string,
  flightRisk = 'low',
  engineerId = 'alex',
) => ({
  id,
  engineerId,
  text,
  flightRisk,
  createdAt,
});

const renderNotes = (notes: unknown[] = [], idleMs?: number) =>
  renderWithProviders(
    <>
      <PrivateNotes member={ALEX} idleMs={idleMs} />
      <Stored />
    </>,
    { initialData: { members: [ALEX] }, initialPrivateData: { flightRisk: notes } },
  );

const field = () => screen.getByRole('textbox', { name: /^Private note/ });

const toggle = () => screen.getByRole('button', { name: SECTION });

describe('PrivateNotes', () => {
  it('is collapsed by default and shows no note text', () => {
    renderNotes([stored('1', 'Quietly interviewing', '2025-03-01T10:00:00.000Z')]);

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Quietly interviewing')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toContainElement(toggle());
  });

  it('shows an empty state with a first-note action once expanded', async () => {
    const user = userEvent.setup();
    renderNotes();

    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'No private notes yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add first note' })).toBeInTheDocument();
  });

  it('lists only this person’s notes, newest first, with no edit or delete controls', async () => {
    const user = userEvent.setup();
    renderNotes([
      stored('1', 'Older note', '2025-01-01T10:00:00.000Z'),
      stored('2', 'Newer note', '2025-02-01T10:00:00.000Z'),
      stored('3', 'Someone else', '2025-03-01T10:00:00.000Z', 'high', 'priya'),
    ]);

    await user.click(toggle());

    const items = within(screen.getByRole('list', { name: 'Private notes' })).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual([
      'Newer note',
      'Older note',
    ]);
    expect(screen.queryByText('Someone else')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|delete/i })).not.toBeInTheDocument();
    expect(items[0].querySelector('time')).toHaveAttribute('datetime', '2025-02-01T10:00:00.000Z');
  });

  it('asks for confirmation, then saves the note and returns focus to Add Note', async () => {
    const user = userEvent.setup();
    renderNotes([stored('1', 'First', '2025-01-01T10:00:00.000Z')]);
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    await user.type(field(), 'Asked about equity');
    await user.click(screen.getByRole('radio', { name: 'High' }));
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('This is private and will never be shared');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('status', { name: 'Stored notes' })).not.toHaveTextContent('equity');

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Asked about equity')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Stored notes' })).toHaveTextContent(
      '"flightRisk":"high"',
    );
    expect(screen.getByRole('button', { name: 'Add Note' })).toHaveFocus();
  });

  it('keeps the draft and saves nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Add first note' }));
    await user.type(field(), 'Draft text');
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(field()).toHaveValue('Draft text');
    expect(screen.getByRole('button', { name: 'Save note' })).toHaveFocus();
    expect(screen.getByRole('status', { name: 'Stored notes' })).toHaveTextContent('[]');
  });

  it('cancels the confirmation with Escape without saving', async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Add first note' }));
    await user.type(field(), 'Draft text');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    await screen.findByRole('alertdialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Stored notes' })).toHaveTextContent('[]');
  });

  it('does not open the confirmation for an empty note and explains why', async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Add first note' }));
    await user.type(field(), '   ');

    await user.click(screen.getByRole('button', { name: 'Save note' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const emptyField = field();
    expect(emptyField).toHaveAccessibleDescription('Write a note before saving');
    expect(emptyField).toHaveFocus();
  });

  it('defaults the level to None and offers the four levels as one radio group', async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Add first note' }));

    const group = screen.getByRole('group', { name: 'Flight risk level' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['none', 'low', 'medium', 'high']);
    expect(within(group).getByRole('radio', { name: 'None' })).toBeChecked();
  });

  it('keeps the note out of browser autofill and limits its length', async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Add first note' }));

    const textarea = field();
    expect(textarea).toHaveAttribute('autocomplete', 'off');
    expect(textarea).not.toHaveAttribute('name');
    expect(textarea).toHaveAttribute('maxlength', '2000');
  });

  it('drops the draft when the section is collapsed and reopened', async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Add first note' }));
    await user.type(field(), 'Do not keep me');

    await user.click(toggle());
    expect(screen.queryByText('Do not keep me')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(toggle());

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('collapses itself after the idle timeout', async () => {
    const user = userEvent.setup();
    renderNotes([stored('1', 'Visible for now', '2025-01-01T10:00:00.000Z')], 50);
    await user.click(toggle());
    expect(screen.getByText('Visible for now')).toBeInTheDocument();

    await waitFor(() => expect(toggle()).toHaveAttribute('aria-expanded', 'false'));

    expect(screen.queryByText('Visible for now')).not.toBeInTheDocument();
  });

  it('has no accessibility violations collapsed, listing notes, or with the form open', async () => {
    const user = userEvent.setup();
    const { container } = renderNotes([stored('1', 'A note', '2025-01-01T10:00:00.000Z')]);
    expect(await axe(container)).toHaveNoViolations();

    await user.click(toggle());
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Add Note' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../data/errors';
import { createConnection, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { ConnectionView } from '../types/connection';
import { buildConnectionViews } from '../utils/connectionViews';
import { PeerConnections } from './PeerConnections';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const SAM = createMember({ id: 'sam', name: 'Sam Okoye' });
const MEMBERS = [ALEX, PRIYA, SAM];

const view = (overrides: Partial<ConnectionView> = {}): ConnectionView => ({
  id: 'c1',
  peerId: PRIYA.id,
  peerName: 'Priya Nair',
  relationship: 'collaborator',
  notes: 'Pairs on the payments rewrite',
  direction: 'outgoing',
  ...overrides,
});

function setup(connections: ConnectionView[] = [view()], memberId = ALEX.id) {
  const user = userEvent.setup();
  const handlers = {
    onAddConnection: vi.fn(async () => undefined),
    onEditConnection: vi.fn(async () => undefined),
    onRemoveConnection: vi.fn(async () => undefined),
  };
  const utils = renderWithProviders(
    <PeerConnections
      memberId={memberId}
      connections={connections}
      members={MEMBERS}
      {...handlers}
    />,
  );
  return { user, ...handlers, ...utils };
}

describe('PeerConnections', () => {
  it('renders each connection with the peer name, relationship badge and notes', () => {
    setup();

    const list = screen.getByRole('list');
    const row = within(list).getByRole('listitem');
    expect(within(row).getByText('Priya Nair')).toBeInTheDocument();
    expect(within(row).getByText('Collaborator')).toBeInTheDocument();
    expect(within(row).getByText('Pairs on the payments rewrite')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Connections' })).toBeInTheDocument();
  });

  it('opens the add form, focused on the first field, when "+ Add connection" is clicked', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Add connection' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
    expect(within(dialog).getByRole('combobox', { name: /Peer name/ })).toHaveFocus();
    expect(within(dialog).getByRole('combobox', { name: /Peer name/ })).toHaveAttribute(
      'autocomplete',
      'off',
    );
    expect(within(dialog).getByLabelText('Relationship type')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Notes (optional)')).toHaveAttribute('rows', '3');
  });

  it('adds a connection with the chosen peer, type and notes', async () => {
    const { user, onAddConnection } = setup([]);
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByRole('combobox', { name: /Peer name/ }), 'sam');
    await user.click(within(dialog).getByRole('option', { name: 'Sam Okoye' }));
    await user.selectOptions(within(dialog).getByLabelText('Relationship type'), 'Mentor');
    await user.type(within(dialog).getByLabelText('Notes (optional)'), 'Coaches on design');
    await user.click(within(dialog).getByRole('button', { name: 'Save Connection' }));

    expect(onAddConnection).toHaveBeenCalledWith({
      targetMemberId: SAM.id,
      targetName: 'Sam Okoye',
      relationship: 'mentor',
      notes: 'Coaches on design',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens the edit form pre-filled with the connection', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Edit connection with Priya Nair' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit connection' });
    expect(within(dialog).getByRole('combobox', { name: /Peer name/ })).toHaveValue('Priya Nair');
    expect(within(dialog).getByLabelText('Relationship type')).toHaveValue('collaborator');
    expect(within(dialog).getByLabelText('Notes (optional)')).toHaveValue(
      'Pairs on the payments rewrite',
    );
  });

  it('saves an edit with the updated values', async () => {
    const { user, onEditConnection } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit connection with Priya Nair' }));
    const dialog = await screen.findByRole('dialog');

    await user.selectOptions(within(dialog).getByLabelText('Relationship type'), 'Stakeholder');
    await user.click(within(dialog).getByRole('button', { name: 'Save Connection' }));

    expect(onEditConnection).toHaveBeenCalledWith('c1', {
      targetMemberId: PRIYA.id,
      targetName: 'Priya Nair',
      relationship: 'stakeholder',
      notes: 'Pairs on the payments rewrite',
    });
  });

  it('asks before removing, and removes once confirmed', async () => {
    const { user, onRemoveConnection } = setup();

    await user.click(screen.getByRole('button', { name: 'Remove connection with Priya Nair' }));

    const confirm = await screen.findByRole('alertdialog', { name: 'Remove connection?' });
    expect(onRemoveConnection).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    expect(onRemoveConnection).toHaveBeenCalledWith('c1');
  });

  it('keeps the connection when removal is cancelled', async () => {
    const { user, onRemoveConnection } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove connection with Priya Nair' }));

    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(onRemoveConnection).not.toHaveBeenCalled();
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
  });

  it("shows a connection one person added on the other person's profile too", () => {
    const stored = [
      createConnection({
        id: 'c9',
        sourceMemberId: ALEX.id,
        targetMemberId: PRIYA.id,
        relationship: 'mentor',
      }),
    ];

    setup(buildConnectionViews(PRIYA.id, stored, MEMBERS), PRIYA.id);

    const row = screen.getByRole('listitem');
    expect(within(row).getByText('Alex Chen')).toBeInTheDocument();
    expect(within(row).getByText('Mentee')).toBeInTheDocument();
  });

  it('shows initials for a cross-team peer typed as free text', () => {
    setup([view({ id: 'c2', peerId: null, peerName: 'Jo Rivera', relationship: 'stakeholder' })]);

    const row = screen.getByRole('listitem');
    expect(within(row).getByText('JR')).toBeInTheDocument();
    expect(within(row).queryByRole('img')).toBeNull();
  });

  it('shows an empty state with a call to action when there are no connections', async () => {
    const { user } = setup([]);

    expect(screen.getByRole('heading', { name: 'No connections yet' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    expect(await screen.findByRole('dialog', { name: 'Add connection' })).toBeInTheDocument();
  });

  it('keeps focus in the form while it is open and returns it to the trigger on close', async () => {
    const { user } = setup();
    const trigger = screen.getByRole('button', { name: 'Add connection' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');

    // Tab through every control and around again: focus never leaves the dialog.
    for (let index = 0; index < 8; index += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('closes the peer list on Escape without closing the dialog', async () => {
    const { user } = setup([]);
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog');
    const combobox = within(dialog).getByRole('combobox', { name: /Peer name/ });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');

    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('chooses a peer with the keyboard and announces the result count', async () => {
    const { user, onAddConnection } = setup([]);
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog');
    const combobox = within(dialog).getByRole('combobox', { name: /Peer name/ });

    await user.type(combobox, 'a');
    expect(within(dialog).getByRole('status')).toHaveTextContent('2 results');
    await user.keyboard('{ArrowDown}');
    expect(combobox).toHaveAttribute(
      'aria-activedescendant',
      within(dialog).getAllByRole('option')[0].id,
    );
    await user.keyboard('{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Save Connection' }));

    expect(onAddConnection).toHaveBeenCalledWith(
      expect.objectContaining({ targetMemberId: PRIYA.id, targetName: 'Priya Nair' }),
    );
  });

  it('offers a free-text name as a cross-team peer when no team member matches', async () => {
    const { user, onAddConnection } = setup([]);
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByRole('combobox', { name: /Peer name/ }), 'Jo Rivera');
    await user.click(
      within(dialog).getByRole('option', { name: 'Add "Jo Rivera" as cross-team peer' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save Connection' }));

    expect(onAddConnection).toHaveBeenCalledWith({
      targetMemberId: null,
      targetName: 'Jo Rivera',
      relationship: 'collaborator',
      notes: '',
    });
  });

  it('treats a full team member name typed out as that member', async () => {
    const { user, onAddConnection } = setup([]);
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByRole('combobox', { name: /Peer name/ }), 'sam okoye');
    await user.click(within(dialog).getByRole('button', { name: 'Save Connection' }));

    expect(onAddConnection).toHaveBeenCalledWith(
      expect.objectContaining({ targetMemberId: SAM.id, targetName: 'Sam Okoye' }),
    );
  });

  it('requires a peer name and refuses a connection to oneself', async () => {
    const { user, onAddConnection } = setup([]);
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Save Connection' });

    await user.click(save);
    expect(within(dialog).getByText('Enter a peer name')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('combobox', { name: /Peer name/ }), 'Alex Chen');
    await user.keyboard('{Escape}');
    await user.click(save);
    expect(
      within(dialog).getByText("A person can't be connected to themselves"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: /Peer name/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(onAddConnection).not.toHaveBeenCalled();
  });

  it('shows a validation message from the data layer and keeps the form open', async () => {
    const { user, onAddConnection } = setup([]);
    onAddConnection.mockRejectedValueOnce(
      new ValidationError('You already have a connection with that person'),
    );
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByRole('combobox', { name: /Peer name/ }), 'sam okoye');
    await user.click(within(dialog).getByRole('button', { name: 'Save Connection' }));

    expect(
      await within(dialog).findByText('You already have a connection with that person'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('cannot change who an incoming connection is with', async () => {
    const { user } = setup(
      [view({ direction: 'incoming', peerId: PRIYA.id, relationship: 'mentee' })],
      ALEX.id,
    );

    await user.click(screen.getByRole('button', { name: 'Edit connection with Priya Nair' }));

    expect(
      within(await screen.findByRole('dialog')).getByRole('combobox', { name: /Peer name/ }),
    ).toBeDisabled();
  });

  it('has no accessibility violations with the list and with the form open', async () => {
    const { user, container } = setup();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const dialog = await screen.findByRole('dialog');

    expect(await axe(dialog)).toHaveNoViolations();
  });
});

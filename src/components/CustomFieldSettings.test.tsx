import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { Settings } from '../pages/Settings';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { CustomFieldDefinition } from '../types/customField';
import type { TeamMember } from '../types/TeamMember';

const field = (id: string, order: number, extra: Partial<CustomFieldDefinition> = {}) =>
  ({ id, name: `Field ${id}`, type: 'text', order, ...extra }) as CustomFieldDefinition;

function Stored() {
  const { get } = useEncryptedStorage();
  return (
    <>
      <output aria-label="Stored definitions">
        {JSON.stringify(get('customFieldDefinitions'))}
      </output>
      <output aria-label="Stored members">{JSON.stringify(get('members'))}</output>
    </>
  );
}

function renderSettings(definitions: CustomFieldDefinition[] = [], members: TeamMember[] = []) {
  return renderWithProviders(
    <>
      <Settings />
      <Stored />
    </>,
    { initialData: { customFieldDefinitions: definitions, members } },
  );
}

const storedDefinitions = () =>
  JSON.parse(
    screen.getByRole('status', { name: 'Stored definitions' }).textContent ?? '[]',
  ) as CustomFieldDefinition[];
const storedMembers = () =>
  JSON.parse(
    screen.getByRole('status', { name: 'Stored members' }).textContent ?? '[]',
  ) as TeamMember[];
const section = () => screen.getByRole('region', { name: 'Custom Fields' });
const rowNames = () =>
  within(screen.getByRole('list', { name: 'Custom fields' }))
    .getAllByRole('listitem')
    .map((row) => within(row).getByText(/^Field /).textContent);

afterEach(() => vi.restoreAllMocks());

describe('Custom Fields settings', () => {
  it('shows an empty state, the counter and the vault advisory when nothing is defined', () => {
    renderSettings();

    expect(within(section()).getByText('No custom fields yet.')).toBeInTheDocument();
    expect(within(section()).getByText('0 / 10 fields used')).toBeInTheDocument();
    expect(within(section()).getByText(/stored in your encrypted vault/)).toBeInTheDocument();
    expect(within(section()).getByRole('button', { name: 'Add field' })).toBeEnabled();
  });

  it('adds a text field and stores it', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(within(section()).getByRole('button', { name: 'Add field' }));
    expect(screen.getByLabelText(/Field name/)).toHaveFocus();
    await user.type(screen.getByLabelText(/Field name/), 'Team');
    await user.click(screen.getByRole('button', { name: 'Save Field' }));

    expect(await within(section()).findByText('Team')).toBeVisible();
    expect(storedDefinitions()).toMatchObject([{ name: 'Team', type: 'text', order: 0 }]);
    expect(within(section()).getByText('1 / 10 fields used')).toBeInTheDocument();
    expect(within(section()).queryByText(/encrypted vault/)).not.toBeInTheDocument();
  });

  it('shows the options box only for a select and saves the options', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(within(section()).getByRole('button', { name: 'Add field' }));

    expect(screen.queryByLabelText('Select options, one per line')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Type'), 'select');
    await user.type(screen.getByLabelText(/Field name/), 'Size');
    await user.type(screen.getByLabelText('Select options, one per line'), 'Small{Enter}Large');
    await user.click(screen.getByRole('button', { name: 'Save Field' }));

    await waitFor(() =>
      expect(storedDefinitions()).toMatchObject([
        { name: 'Size', type: 'select', options: ['Small', 'Large'] },
      ]),
    );
  });

  it('shows an inline error for an empty name and keeps focus there', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(within(section()).getByRole('button', { name: 'Add field' }));

    await user.click(screen.getByRole('button', { name: 'Save Field' }));

    const name = screen.getByLabelText(/Field name/);
    expect(name).toBeInvalid();
    expect(name).toHaveAccessibleDescription('Enter a field name');
    expect(name).toHaveFocus();
    expect(storedDefinitions()).toEqual([]);
  });

  it('rejects a duplicate name and a select without options', async () => {
    const user = userEvent.setup();
    renderSettings([field('a', 0, { name: 'Team' })]);
    await user.click(within(section()).getByRole('button', { name: 'Add field' }));

    await user.type(screen.getByLabelText(/Field name/), 'team');
    await user.click(screen.getByRole('button', { name: 'Save Field' }));
    expect(screen.getByText('A field with that name already exists')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Type'), 'select');
    await user.clear(screen.getByLabelText(/Field name/));
    await user.type(screen.getByLabelText(/Field name/), 'Size');
    await user.click(screen.getByRole('button', { name: 'Save Field' }));
    expect(screen.getByText('Add at least one option')).toBeInTheDocument();
    expect(screen.getByLabelText('Select options, one per line')).toHaveFocus();
  });

  it('cancels the add form without saving', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(within(section()).getByRole('button', { name: 'Add field' }));
    await user.type(screen.getByLabelText(/Field name/), 'Team');

    await user.click(within(section()).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText(/Field name/)).not.toBeInTheDocument();
    expect(storedDefinitions()).toEqual([]);
  });

  it('edits a field in place, warning that unfit values are cleared', async () => {
    const user = userEvent.setup();
    renderSettings([field('a', 0)], [createMember({ id: 'm1', customFields: { a: 'Payments' } })]);

    await user.click(screen.getByRole('button', { name: 'Edit Field a field' }));
    expect(screen.getByText(/clears any values that no longer fit/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Field name/));
    await user.type(screen.getByLabelText(/Field name/), 'Squad');
    await user.click(screen.getByRole('button', { name: 'Save Field' }));

    await waitFor(() => expect(storedDefinitions()[0].name).toBe('Squad'));
    expect(storedMembers()[0].customFields).toEqual({ a: 'Payments' });
  });

  it('disables adding at ten fields, keeps the button focusable and explains why', async () => {
    const user = userEvent.setup();
    renderSettings(Array.from({ length: 10 }, (_, index) => field(`f${index}`, index)));
    const add = within(section()).getByRole('button', { name: 'Add field' });

    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAttribute('title', 'You can add up to 10 custom fields');
    expect(add).toHaveAccessibleDescription('You can add up to 10 custom fields');
    expect(within(section()).getByText('10 / 10 fields used')).toBeInTheDocument();
    add.focus();
    expect(add).toHaveFocus();
    await user.click(add);
    expect(screen.queryByLabelText(/Field name/)).not.toBeInTheDocument();
  });

  describe('deleting', () => {
    const members = [
      createMember({ id: 'm1', customFields: { a: 'x', b: 'keep' } }),
      createMember({ id: 'm2', customFields: { a: 'y' } }),
      createMember({ id: 'm3', customFields: {} }),
    ];

    it('warns how many people lose a value, focuses Cancel first and keeps the field on cancel', async () => {
      const user = userEvent.setup();
      renderSettings([field('a', 0), field('b', 1)], members);

      await user.click(screen.getByRole('button', { name: 'Delete Field a field' }));

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAccessibleDescription(
        'Deleting this field will remove its value from all 2 team members. This cannot be undone.',
      );
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(storedDefinitions()).toHaveLength(2);
      expect(storedMembers()[0].customFields).toEqual({ a: 'x', b: 'keep' });
    });

    it('removes the field and every member value for it, keeping the others', async () => {
      const user = userEvent.setup();
      renderSettings([field('a', 0), field('b', 1)], members);

      await user.click(screen.getByRole('button', { name: 'Delete Field a field' }));
      await user.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete Field' }),
      );

      await waitFor(() => expect(storedDefinitions()).toMatchObject([{ id: 'b', order: 0 }]));
      expect(storedMembers().map((member) => member.customFields)).toEqual([{ b: 'keep' }, {}, {}]);
      expect(rowNames()).toEqual(['Field b']);
    });

    it('uses the singular for one person', async () => {
      const user = userEvent.setup();
      renderSettings([field('a', 0)], [members[1]]);

      await user.click(screen.getByRole('button', { name: 'Delete Field a field' }));

      expect(screen.getByRole('alertdialog')).toHaveTextContent('from all 1 team member.');
    });
  });

  describe('reordering', () => {
    const three = [field('a', 0), field('b', 1), field('c', 2)];

    it('moves a field with the arrow keys on its handle and announces the new position', async () => {
      const user = userEvent.setup();
      renderSettings(three);
      const handle = screen.getByRole('button', { name: 'Reorder Field a' });
      expect(handle).toHaveAttribute('aria-roledescription', 'draggable');

      handle.focus();
      await user.keyboard('{ArrowDown}');

      await waitFor(() => expect(rowNames()).toEqual(['Field b', 'Field a', 'Field c']));
      expect(within(section()).getByText('Field a moved to position 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reorder Field a' })).toHaveFocus();
      expect(storedDefinitions().map((item) => item.id)).toEqual(['b', 'a', 'c']);
    });

    it('ignores an arrow past either end', async () => {
      const user = userEvent.setup();
      renderSettings(three);

      screen.getByRole('button', { name: 'Reorder Field a' }).focus();
      await user.keyboard('{ArrowUp}');

      expect(rowNames()).toEqual(['Field a', 'Field b', 'Field c']);
      expect(within(section()).queryByText(/moved to position/)).not.toBeInTheDocument();
    });

    it('moves a field with the up and down buttons', async () => {
      const user = userEvent.setup();
      renderSettings(three);

      expect(screen.getByRole('button', { name: 'Move Field a up' })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Move Field c up' }));

      await waitFor(() => expect(rowNames()).toEqual(['Field a', 'Field c', 'Field b']));
    });

    it('moves a field by dragging its handle to another row', async () => {
      renderSettings(three);
      const rows = within(screen.getByRole('list', { name: 'Custom fields' })).getAllByRole(
        'listitem',
      );
      rows.forEach((row, index) =>
        vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
          top: index * 100,
          height: 100,
          bottom: index * 100 + 100,
          left: 0,
          right: 100,
          width: 100,
          x: 0,
          y: index * 100,
          toJSON: () => ({}),
        }),
      );
      const handle = screen.getByRole('button', { name: 'Reorder Field a' });

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 50 });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 260 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 260 });

      await waitFor(() => expect(rowNames()).toEqual(['Field b', 'Field c', 'Field a']));
      expect(storedDefinitions().map((item) => item.id)).toEqual(['b', 'c', 'a']);
    });

    it('does nothing when a drag is cancelled or released where it started', async () => {
      renderSettings(three);
      const handle = screen.getByRole('button', { name: 'Reorder Field a' });

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 10 });
      fireEvent.pointerCancel(handle, { pointerId: 1 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 10 });

      expect(rowNames()).toEqual(['Field a', 'Field b', 'Field c']);
    });
  });

  it('has no accessibility violations with fields, the add form and the delete dialog', async () => {
    const user = userEvent.setup();
    const { container } = renderSettings([field('a', 0), field('b', 1, { type: 'url' })]);
    await user.click(within(section()).getByRole('button', { name: 'Add field' }));

    expect(await axe(container)).toHaveNoViolations();
  });
});

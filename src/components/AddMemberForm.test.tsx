import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { CustomFieldDefinition } from '../types/customField';
import type { TeamMember } from '../types/TeamMember';
import { AddMemberForm } from './AddMemberForm';

const definitions: CustomFieldDefinition[] = [
  { id: 'squad', name: 'Squad', type: 'text', order: 0 },
  { id: 'size', name: 'Shirt size', type: 'select', options: ['S', 'L'], order: 1 },
  { id: 'since', name: 'Certified', type: 'date', order: 2 },
  { id: 'wiki', name: 'Wiki page', type: 'url', order: 3 },
];

function Stored() {
  const { get } = useEncryptedStorage();
  return <output aria-label="Stored members">{JSON.stringify(get('members') ?? [])}</output>;
}

function renderForm(editMember?: TeamMember, fields: CustomFieldDefinition[] = definitions) {
  const onSuccess = vi.fn();
  renderWithProviders(
    <>
      <AddMemberForm
        members={editMember ? [editMember] : []}
        editMember={editMember}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
      <Stored />
    </>,
    { initialData: { members: editMember ? [editMember] : [], customFieldDefinitions: fields } },
  );
  return onSuccess;
}

const saved = () =>
  JSON.parse(
    screen.getByRole('status', { name: 'Stored members' }).textContent ?? '[]',
  ) as TeamMember[];

describe('AddMemberForm custom fields', () => {
  it('shows one input per defined field, after the standard fields, in order', () => {
    renderForm();

    const labels = screen
      .getAllByText(/./, { selector: 'label' })
      .map((label) => label.textContent);
    expect(labels.slice(-4)).toEqual(['Squad', 'Shirt size', 'Certified', 'Wiki page']);
    expect(screen.getByLabelText('Certified')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Wiki page')).toHaveAttribute('type', 'url');
    expect(screen.getByLabelText('Squad')).toHaveAttribute('maxlength', '500');
    expect(
      within(screen.getByLabelText('Shirt size')).getByRole('option', { name: 'None' }),
    ).toBeInTheDocument();
  });

  it('adds nothing when no field is defined', () => {
    renderForm(undefined, []);

    expect(screen.queryByLabelText('Squad')).not.toBeInTheDocument();
  });

  it('saves the values of a new member keyed by field id and leaves empty ones out', async () => {
    const user = userEvent.setup();
    const onSuccess = renderForm();

    await user.type(screen.getByLabelText(/Name/), 'Dana Lee');
    await user.type(screen.getByLabelText('Squad'), '  Payments ');
    await user.selectOptions(screen.getByLabelText('Shirt size'), 'L');
    await user.type(screen.getByLabelText('Wiki page'), 'https://example.com/dana');
    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(saved()[0].customFields).toEqual({
      squad: 'Payments',
      size: 'L',
      wiki: 'https://example.com/dana',
    });
  });

  it('prefills an edit, changes one value and clears another', async () => {
    const user = userEvent.setup();
    const member = createMember({
      id: 'm1',
      name: 'Alice Park',
      customFields: { squad: 'Payments', size: 'S', gone: 'old' },
    });
    renderForm(member);
    expect(screen.getByLabelText('Squad')).toHaveValue('Payments');
    expect(screen.getByLabelText('Shirt size')).toHaveValue('S');

    await user.clear(screen.getByLabelText('Squad'));
    await user.selectOptions(screen.getByLabelText('Shirt size'), 'L');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(saved()[0].customFields).toEqual({ size: 'L' }));
  });

  it('shows an inline error for an unsafe link, focuses it and does not save', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Name/), 'Dana Lee');
    await user.type(screen.getByLabelText('Wiki page'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    const wiki = screen.getByLabelText('Wiki page');
    expect(wiki).toBeInvalid();
    expect(wiki).toHaveAccessibleDescription('Enter a link that starts with https:// or http://');
    expect(wiki).toHaveFocus();
    expect(saved()).toEqual([]);
  });

  it('rejects HTML in a text value', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Name/), 'Dana Lee');
    await user.type(screen.getByLabelText('Squad'), '<b>bold</b>');
    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(screen.getByLabelText('Squad')).toHaveAccessibleDescription('Must not contain HTML');
    expect(saved()).toEqual([]);
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createDecision, createFollowUp, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { DecisionsGlobalView } from './DecisionsGlobalView';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

const privateData = () => ({
  decisions: [
    createDecision({ engineerId: ALEX.id, title: 'Alex decision' }),
    createDecision({ engineerId: PRIYA.id, title: 'Priya decision' }),
    createDecision({ engineerId: 'gone', title: 'Orphan decision' }),
  ],
  followUps: [
    createFollowUp({ engineerId: ALEX.id, title: 'Alex follow-up' }),
    createFollowUp({ engineerId: PRIYA.id, title: 'Priya follow-up' }),
  ],
});

const renderPage = (initialPrivateData: Record<string, unknown> = privateData()) =>
  renderWithProviders(<DecisionsGlobalView />, {
    initialData: { members: [ALEX, PRIYA] },
    initialPrivateData,
  });

describe('DecisionsGlobalView', () => {
  it('has a page heading that takes focus', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Decisions & Follow-ups' }),
    ).toHaveFocus();
  });

  it('lists everyone’s records with the person named, skipping people no longer on the team', async () => {
    renderPage();

    const list = await screen.findByRole('list', { name: 'Decisions and follow-ups' });
    expect(within(list).getAllByRole('article')).toHaveLength(4);
    expect(within(list).queryByText('Orphan decision')).not.toBeInTheDocument();
    expect(within(list).getAllByRole('link', { name: 'Alex Chen' })).toHaveLength(2);
  });

  it('offers a person dropdown with everyone on the team', async () => {
    renderPage();

    const select = await screen.findByRole('combobox', { name: 'Person' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All team members', 'Alex Chen', 'Priya Nair']);
  });

  it('narrows the list to the chosen person and widens it again', async () => {
    const user = userEvent.setup();
    renderPage();
    const select = await screen.findByRole('combobox', { name: 'Person' });

    await user.selectOptions(select, 'Priya Nair');
    const list = screen.getByRole('list', { name: 'Decisions and follow-ups' });
    expect(within(list).getAllByRole('article')).toHaveLength(2);
    expect(within(list).getByRole('article', { name: 'Decision: Priya decision' })).toBeVisible();

    await user.selectOptions(select, 'All team members');
    expect(
      within(screen.getByRole('list', { name: 'Decisions and follow-ups' })).getAllByRole(
        'article',
      ),
    ).toHaveLength(4);
  });

  it('combines the person and type filters', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Person' }), 'Alex Chen');
    await user.click(screen.getByRole('radio', { name: 'Follow-ups' }));

    const list = screen.getByRole('list', { name: 'Decisions and follow-ups' });
    expect(within(list).getAllByRole('article')).toHaveLength(1);
    expect(within(list).getByRole('article', { name: 'Follow-up: Alex follow-up' })).toBeVisible();
  });

  it('marks a follow-up done from the page', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByRole('article', { name: 'Follow-up: Alex follow-up' });

    await user.click(within(card).getByRole('button', { name: 'Mark as done' }));

    expect(await within(card).findByRole('button', { name: 'Mark as pending' })).toBeVisible();
  });

  it('shows the empty state when nothing has been captured', async () => {
    renderPage({});

    expect(await screen.findByText('No decisions or follow-ups yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPage();
    await screen.findByRole('list', { name: 'Decisions and follow-ups' });

    expect(await axe(container)).toHaveNoViolations();
  });
});

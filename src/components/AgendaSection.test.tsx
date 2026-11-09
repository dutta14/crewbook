import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { AgendaSection } from './AgendaSection';

const ALEX = 'alex';

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'a1',
  memberId: ALEX,
  text: 'Promo timeline',
  addedBy: 'engineer',
  createdAt: '2026-01-05T09:00:00Z',
  includeInShare: true,
  ...overrides,
});

const renderAgenda = (mode: 'prep' | 'live', items: unknown[] = []) =>
  renderWithProviders(<AgendaSection memberId={ALEX} memberName="Alex Chen" mode={mode} />, {
    initialPrivateData: { agendaItems: items },
  });

describe('AgendaSection in prep', () => {
  it('shows an empty state and the add form when there are no items', () => {
    renderAgenda('prep');

    expect(screen.getByRole('heading', { name: "Engineer's Agenda" })).toBeInTheDocument();
    expect(screen.getByText('No agenda items yet. Add one below.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add an agenda item' })).toBeInTheDocument();
  });

  it('lists items with who added them and a remove button each', () => {
    renderAgenda('prep', [entry(), entry({ id: 'a2', text: 'Team offsite', addedBy: 'manager' })]);

    const list = screen.getByRole('list', { name: 'Agenda items' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByLabelText('Added by Alex Chen')).toBeInTheDocument();
    expect(screen.getByLabelText('Added by You')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove agenda item: Promo timeline' }),
    ).toBeVisible();
  });

  it('adds an item and announces it', async () => {
    const user = userEvent.setup();
    renderAgenda('prep');

    await user.type(screen.getByRole('textbox', { name: 'Add an agenda item' }), 'Career growth');
    await user.click(screen.getByRole('button', { name: 'Add agenda item' }));

    expect(await screen.findByText('Career growth')).toBeInTheDocument();
    expect(screen.getByText('Career growth added to agenda')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add an agenda item' })).toHaveFocus();
  });

  it('records an item as added by the engineer when chosen', async () => {
    const user = userEvent.setup();
    renderAgenda('prep');

    await user.selectOptions(screen.getByLabelText('Added by'), 'Alex Chen');
    await user.type(screen.getByRole('textbox', { name: 'Add an agenda item' }), 'Workload');
    await user.click(screen.getByRole('button', { name: 'Add agenda item' }));

    expect(await screen.findByLabelText('Added by Alex Chen')).toBeInTheDocument();
  });

  it('keeps the add button disabled until there is text', async () => {
    const user = userEvent.setup();
    renderAgenda('prep');
    const add = screen.getByRole('button', { name: 'Add agenda item' });

    expect(add).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Add an agenda item' }), 'x');
    expect(add).toBeEnabled();
  });

  it('stops typing at 500 characters', async () => {
    const user = userEvent.setup();
    renderAgenda('prep');
    const input = screen.getByRole('textbox', { name: 'Add an agenda item' });

    await user.click(input);
    await user.paste('x'.repeat(501));

    expect(input).toHaveValue('x'.repeat(500));
  });

  it('shows a validation message when nothing is left after tags are removed', async () => {
    const user = userEvent.setup();
    renderAgenda('prep');

    await user.type(screen.getByRole('textbox', { name: 'Add an agenda item' }), '<b></b>');
    await user.click(screen.getByRole('button', { name: 'Add agenda item' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('must not be empty');
  });

  it('removes an item and moves focus to the heading', async () => {
    const user = userEvent.setup();
    renderAgenda('prep', [entry()]);

    await user.click(screen.getByRole('button', { name: 'Remove agenda item: Promo timeline' }));

    await waitFor(() => expect(screen.queryByText('Promo timeline')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: "Engineer's Agenda" })).toHaveFocus();
  });

  it('marks an item as not shared when the manager unticks it, and back', async () => {
    const user = userEvent.setup();
    renderAgenda('prep', [entry()]);
    const toggle = screen.getByRole('checkbox', { name: 'Include in share link: Promo timeline' });

    expect(toggle).toBeChecked();
    expect(screen.queryByText('Not shared')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(await screen.findByText('Not shared')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Include in share link/ }));
    await waitFor(() => expect(screen.queryByText('Not shared')).not.toBeInTheDocument());
  });

  it('treats an item with no sharing choice as not shared', () => {
    renderAgenda('prep', [entry({ includeInShare: undefined })]);

    expect(screen.getByText('Not shared')).toBeInTheDocument();
  });

  it('shortens long text in button labels', () => {
    renderAgenda('prep', [entry({ text: 'a'.repeat(60) })]);

    expect(
      screen.getByRole('button', { name: `Remove agenda item: ${'a'.repeat(40)}…` }),
    ).toBeInTheDocument();
  });

  it('shows another person’s items nowhere', () => {
    renderAgenda('prep', [entry({ memberId: 'priya', text: 'Not for Alex' })]);

    expect(screen.queryByText('Not for Alex')).not.toBeInTheDocument();
  });

  it('has no accessibility violations with items', async () => {
    const { container } = renderAgenda('prep', [
      entry(),
      entry({ id: 'a2', includeInShare: false }),
    ]);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AgendaSection in live mode', () => {
  it('lists items as a checklist with no add form or remove buttons', () => {
    renderAgenda('live', [entry()]);

    expect(
      screen.getByRole('checkbox', { name: 'Mark Promo timeline as discussed' }),
    ).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ticks an item off and keeps it visible', async () => {
    const user = userEvent.setup();
    renderAgenda('live', [entry()]);

    await user.click(screen.getByRole('checkbox', { name: 'Mark Promo timeline as discussed' }));

    const box = await screen.findByRole('checkbox', { name: 'Mark Promo timeline as discussed' });
    await waitFor(() => expect(box).toBeChecked());
    expect(screen.getByText('Promo timeline')).toBeVisible();
  });

  it('shows an empty state', () => {
    renderAgenda('live');

    expect(screen.getByText('No agenda items for this 1:1.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderAgenda('live', [entry(), entry({ id: 'a2', discussed: true })]);

    expect(await axe(container)).toHaveNoViolations();
  });
});

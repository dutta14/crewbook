import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { createConnection, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { ThreeSixtyPlanning } from './ThreeSixtyPlanning';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const SAM = createMember({ id: 'sam', name: 'Sam Okoye' });
const DANA = createMember({ id: 'dana', name: 'Dana Wu' });
const MEMBERS = [SAM, ALEX, DANA, PRIYA];

const CONNECTIONS = [
  createConnection({
    sourceMemberId: ALEX.id,
    targetMemberId: PRIYA.id,
    targetName: PRIYA.name,
    relationship: 'collaborator',
  }),
  createConnection({
    sourceMemberId: ALEX.id,
    targetMemberId: SAM.id,
    targetName: SAM.name,
    relationship: 'mentor',
  }),
  createConnection({
    sourceMemberId: ALEX.id,
    targetMemberId: null,
    targetName: 'Jo Rivera',
    relationship: 'stakeholder',
  }),
];

function setup() {
  const user = userEvent.setup();
  const utils = renderWithProviders(
    <ThreeSixtyPlanning members={MEMBERS} connections={CONNECTIONS} />,
  );
  return { user, ...utils };
}

const choose = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.selectOptions(screen.getByLabelText('Select team member'), name);

describe('ThreeSixtyPlanning', () => {
  it('offers every team member, in name order, in the person selector', () => {
    setup();

    const options = within(screen.getByLabelText('Select team member')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Choose a team member',
      'Alex Chen',
      'Dana Wu',
      'Priya Nair',
      'Sam Okoye',
    ]);
  });

  it('shows no plan until someone is chosen', () => {
    setup();

    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText(/reviewers? selected/)).toBeNull();
  });

  it('lists the chosen person’s connections with a checkbox each', async () => {
    const { user } = setup();

    await choose(user, 'Alex Chen');

    const list = screen.getByRole('list', { name: 'Connections for Alex Chen' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Include Priya Nair as reviewer' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Include Sam Okoye as reviewer' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Include Jo Rivera as reviewer' })).toBeVisible();
  });

  it('pre-checks collaborators and stakeholders and leaves mentors unchecked', async () => {
    const { user } = setup();

    await choose(user, 'Alex Chen');

    expect(screen.getByRole('checkbox', { name: 'Include Priya Nair as reviewer' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Include Jo Rivera as reviewer' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Include Sam Okoye as reviewer' }),
    ).not.toBeChecked();
  });

  it('shows the reviewer count and updates it as boxes are toggled', async () => {
    const { user } = setup();
    await choose(user, 'Alex Chen');
    expect(screen.getByText('2 reviewers selected')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Include Sam Okoye as reviewer' }));
    expect(screen.getByText('3 reviewers selected')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Include Priya Nair as reviewer' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include Jo Rivera as reviewer' }));
    expect(screen.getByText('1 reviewer selected')).toBeInTheDocument();
  });

  it('announces the count through a polite live region', async () => {
    const { user } = setup();
    await choose(user, 'Alex Chen');

    const summary = screen.getByText('2 reviewers selected');

    expect(summary).toHaveAttribute('aria-live', 'polite');
    await user.click(screen.getByRole('checkbox', { name: 'Include Sam Okoye as reviewer' }));
    expect(screen.getByText('3 reviewers selected')).toBe(summary);
  });

  it('shows the other side of a connection, with the relationship turned around', async () => {
    const { user } = setup();

    await choose(user, 'Sam Okoye');

    expect(screen.getByText('Mentee')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Include Alex Chen as reviewer' }),
    ).not.toBeChecked();
  });

  it('keeps each person’s choices separate while the page is open', async () => {
    const { user } = setup();
    await choose(user, 'Alex Chen');
    await user.click(screen.getByRole('checkbox', { name: 'Include Sam Okoye as reviewer' }));

    await choose(user, 'Priya Nair');
    await choose(user, 'Alex Chen');

    expect(screen.getByRole('checkbox', { name: 'Include Sam Okoye as reviewer' })).toBeChecked();
  });

  it('shows an empty state when the person has no connections', async () => {
    const { user } = setup();

    await choose(user, 'Dana Wu');

    expect(screen.getByRole('heading', { name: 'No connections yet' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/reviewers? selected/)).toBeNull();
  });

  it('warns that selections are not shared and never writes them anywhere', async () => {
    const { user } = setup();

    await choose(user, 'Alex Chen');
    await user.click(screen.getByRole('checkbox', { name: 'Include Sam Okoye as reviewer' }));

    expect(
      screen.getByText('Reviewer selections are not shared with team members'),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(Object.keys(window.localStorage)).toHaveLength(0);
  });

  it('has no accessibility violations with a plan open', async () => {
    const { user, container } = setup();
    await choose(user, 'Alex Chen');

    expect(await axe(container)).toHaveNoViolations();
  });
});

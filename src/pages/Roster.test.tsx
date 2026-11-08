import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { TeamMember } from '../types/TeamMember';
import { Roster } from './Roster';

function Profile() {
  return <h1>Profile page</h1>;
}

function CurrentUrl() {
  const { pathname, search, hash } = useLocation();
  return <output aria-label="Current URL">{pathname + search + hash}</output>;
}

function renderRoster(members: TeamMember[]) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/roster" element={<Roster />} />
        <Route path="/person/:id" element={<Profile />} />
      </Routes>
      <CurrentUrl />
    </>,
    { route: '/roster', initialData: { members } },
  );
}

const team = (): TeamMember[] => [
  createMember({
    id: 'a',
    name: 'Alice Park',
    role: 'Staff Engineer',
    level: 'L6',
    status: 'active',
    startDate: '2019-04-01',
  }),
  createMember({
    id: 'b',
    name: 'bob Singh',
    role: 'Product Designer',
    level: 'L2',
    status: 'on_leave',
    startDate: '2022-09-12',
  }),
  createMember({
    id: 'c',
    name: 'Carmen Diaz',
    role: 'Engineer',
    level: 'L10',
    status: 'departing',
    startDate: '2021-01-20',
  }),
  createMember({
    id: 'd',
    name: 'Dev Patel',
    role: 'Software Engineer',
    level: 'L3',
    status: 'new_hire',
    startDate: '2025-06-15',
  }),
];

const rowNames = () =>
  screen.getAllByTestId('member-row').map((row) => within(row).getByRole('link').textContent ?? '');

// The toast container is also a status region, so find this one by its text.
const liveRegion = () => screen.getByText(/^\d+ members? found$/);

afterEach(() => {
  vi.useRealTimers();
});

describe('Roster', () => {
  it('renders all team members in the list', () => {
    renderRoster(team());

    expect(screen.getAllByTestId('member-row')).toHaveLength(4);
    expect(screen.getByRole('table', { name: 'Team members' })).toBeInTheDocument();
  });

  it('renders the page title as the h1', () => {
    renderRoster(team());

    expect(screen.getByRole('heading', { level: 1, name: 'Team' })).toBeInTheDocument();
  });

  it('displays avatar initials, name, role, level, and status badge for each member', () => {
    renderRoster([team()[0]]);

    const row = screen.getByTestId('member-row');
    expect(within(row).getByText('AP')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Alice Park' })).toBeInTheDocument();
    expect(within(row).getByText('Staff Engineer')).toBeInTheDocument();
    expect(within(row).getByText('L6')).toHaveClass('level-tag');
    expect(within(row).getByText('Active')).toHaveClass('status-badge--active');
  });

  it('does not render member emails', () => {
    renderRoster(team());

    expect(screen.queryByText(/@example\.com/)).not.toBeInTheDocument();
  });

  it('new hires show days-until-start countdown', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2025, 5, 10, 12) });
    renderRoster(team());

    const countdown = screen.getByText('Starts in 5 days');
    expect(countdown.tagName).toBe('TIME');
    expect(countdown).toHaveAttribute('datetime', '2025-06-15');
  });

  it('new hire starting today shows "Starts today"', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2025, 5, 15, 9) });
    renderRoster(team());

    expect(screen.getByText('Starts today')).toBeInTheDocument();
  });

  it('a new hire starting tomorrow uses the singular day', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2025, 5, 14, 9) });
    renderRoster(team());

    expect(screen.getByText('Starts in 1 day')).toBeInTheDocument();
  });

  it('shows no countdown for a new hire whose start date has passed', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2025, 6, 1) });
    renderRoster(team());

    expect(screen.queryByText(/^Starts/)).not.toBeInTheDocument();
  });

  it('shows no countdown for members who are not new hires', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2018, 0, 1) });
    renderRoster([team()[0]]);

    expect(screen.queryByText(/^Starts/)).not.toBeInTheDocument();
  });

  it('search filters members by name', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.type(screen.getByRole('searchbox'), 'carmen');

    expect(rowNames()).toEqual(['Carmen Diaz']);
  });

  it('search filters members by role', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.type(screen.getByRole('searchbox'), 'designer');

    expect(rowNames()).toEqual(['bob Singh']);
  });

  it('search is case-insensitive', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.type(screen.getByRole('searchbox'), 'BOB SINGH');

    expect(rowNames()).toEqual(['bob Singh']);
  });

  it('search ignores surrounding whitespace', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.type(screen.getByRole('searchbox'), '  alice  ');

    expect(rowNames()).toEqual(['Alice Park']);
  });

  it('search input has the expected placeholder and turns autocomplete off', () => {
    renderRoster(team());

    const input = screen.getByPlaceholderText('Search by name or role...');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText('Search team members by name or role')).toBe(input);
    expect(screen.getByRole('search')).toContainElement(input);
  });

  it('search with no matches shows "No members found" message', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.type(screen.getByRole('searchbox'), 'zzznonexistent');

    expect(screen.getByText('No members found')).toBeInTheDocument();
    expect(screen.queryByTestId('member-row')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument();
  });

  it('search announces result count via aria-live region', async () => {
    const user = userEvent.setup();
    renderRoster(team());
    const status = liveRegion();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('4 members found');

    await user.type(screen.getByRole('searchbox'), 'engineer');
    expect(status).toHaveTextContent('3 members found');

    await user.type(screen.getByRole('searchbox'), ' zzz');
    expect(status).toHaveTextContent('0 members found');
  });

  it('announces a single result without plural wording and never names members', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.type(screen.getByRole('searchbox'), 'alice');

    expect(liveRegion().textContent).toBe('1 member found');
  });

  it('status filter shows only matching members', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.click(screen.getByRole('radio', { name: 'On Leave' }));
    expect(rowNames()).toEqual(['bob Singh']);

    await user.click(screen.getByRole('radio', { name: 'Departing' }));
    expect(rowNames()).toEqual(['Carmen Diaz']);

    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getAllByTestId('member-row')).toHaveLength(4);
  });

  it('status filter combines with search', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await user.type(screen.getByRole('searchbox'), 'designer');

    expect(screen.getByText('No members found')).toBeInTheDocument();
  });

  it('filter chips use role="radiogroup" with aria-label', () => {
    renderRoster(team());

    const group = screen.getByRole('radiogroup', { name: 'Filter by status' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['All', 'Active', 'On Leave', 'Departing', 'New Hire']);
    expect(within(group).getByRole('radio', { name: 'All' })).toBeChecked();
  });

  it('arrow keys move between filter chips and apply the filter', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    screen.getByRole('radio', { name: 'All' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'Active' })).toHaveFocus();
    expect(rowNames()).toEqual(['Alice Park']);
  });

  it('sort by name orders alphabetically', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'level');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'name');

    expect(rowNames()).toEqual(['Alice Park', 'bob Singh', 'Carmen Diaz', 'Dev Patel']);
  });

  it('sort by start date orders chronologically', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'startDate');

    expect(rowNames()).toEqual(['Alice Park', 'Carmen Diaz', 'bob Singh', 'Dev Patel']);
  });

  it('sort by level orders correctly', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'level');

    expect(rowNames()).toEqual(['bob Singh', 'Dev Patel', 'Alice Park', 'Carmen Diaz']);
  });

  it('announces the result count after sorting', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'level');

    expect(liveRegion()).toHaveTextContent('4 members found');
  });

  it('clicking a member navigates to /person/:id', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.click(screen.getByRole('link', { name: 'Carmen Diaz' }));

    expect(screen.getByRole('heading', { name: 'Profile page' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/person/c');
  });

  it('keeps search and filter state out of the URL', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.type(screen.getByRole('searchbox'), 'alice');
    await user.click(screen.getByRole('radio', { name: 'Departing' }));

    expect(screen.getByLabelText('Current URL')).toHaveTextContent(/^\/roster$/);
  });

  it('puts no member data in DOM attributes other than the profile link', () => {
    const { container } = renderRoster(team());

    const attributes = Array.from(container.querySelectorAll('[data-testid], [title]'));
    expect(
      attributes.every((element) => element.getAttribute('data-testid') === 'member-row'),
    ).toBe(true);
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('empty state renders when no members exist', () => {
    renderRoster([]);

    expect(screen.getByRole('heading', { level: 1, name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'No team members yet' })).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('empty state CTA button reads "Add your first team member"', () => {
    renderRoster([]);

    expect(screen.getByRole('button', { name: 'Add your first team member' })).toBeEnabled();
  });

  it('the empty state CTA opens the add member dialog', async () => {
    const user = userEvent.setup();
    renderRoster([]);

    await user.click(screen.getByRole('button', { name: 'Add your first team member' }));

    expect(screen.getByRole('dialog', { name: 'Add Team Member' })).toBeInTheDocument();
    expect(screen.queryByText('Adding team members is coming soon.')).not.toBeInTheDocument();
  });

  it('the header Add member button opens the add member dialog', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.click(screen.getByRole('button', { name: 'Add member' }));

    expect(screen.getByRole('dialog', { name: 'Add Team Member' })).toBeInTheDocument();
  });

  it('adding a member from the empty state shows the roster, a toast, and the new row', async () => {
    const user = userEvent.setup();
    renderRoster([]);

    await user.click(screen.getByRole('button', { name: 'Add your first team member' }));
    await user.type(screen.getByLabelText(/^Name/), 'Priya Sharma');
    await user.click(screen.getByRole('button', { name: 'Add Member' }));

    expect(await screen.findByText('Priya Sharma added to your team')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Priya Sharma']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists existing members in the new member manager dropdown', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.click(screen.getByRole('button', { name: 'Add member' }));

    const manager = screen.getByRole('combobox', { name: 'Manager' });
    expect(within(manager).getAllByRole('option')).toHaveLength(5);
  });

  it('keyboard: Tab moves through search, filters, sort, and table rows', async () => {
    const user = userEvent.setup();
    renderRoster(team());

    await user.tab();
    await user.tab();
    expect(screen.getByRole('searchbox')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Alice Park' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Profile page' })).toBeInTheDocument();
  });

  it('has no accessibility violations with members', async () => {
    const { container } = renderRoster(team());

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when empty', async () => {
    const { container } = renderRoster([]);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Roster on a narrow screen', () => {
  const useNarrowScreen = () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  };

  it('renders cards in a list instead of a table', () => {
    useNarrowScreen();
    renderRoster(team());

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Team members' })).toBeInTheDocument();
    expect(screen.getAllByTestId('member-row')).toHaveLength(4);
  });

  it('shows name, role, level, status and countdown on each card', () => {
    useNarrowScreen();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2025, 5, 10, 12) });
    renderRoster(team());

    const card = screen.getAllByTestId('member-row')[3];
    expect(within(card).getByRole('link', { name: 'Dev Patel' })).toBeInTheDocument();
    expect(within(card).getByText('Software Engineer')).toBeInTheDocument();
    expect(within(card).getByText('L3')).toBeInTheDocument();
    expect(within(card).getByText('New hire')).toHaveClass('status-badge--new');
    expect(within(card).getByText('Starts in 5 days')).toBeInTheDocument();
  });

  it('navigates to the profile when a card link is clicked', async () => {
    useNarrowScreen();
    const user = userEvent.setup();
    renderRoster(team());

    await user.click(screen.getByRole('link', { name: 'Alice Park' }));

    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/person/a');
  });

  it('has no accessibility violations', async () => {
    useNarrowScreen();
    const { container } = renderRoster(team());

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Roster live updates', () => {
  it('re-renders when the media query result changes', () => {
    let listener: () => void = () => undefined;
    let matches = false;
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        get matches() {
          return matches;
        },
        addEventListener: (_: string, next: () => void) => {
          listener = next;
        },
        removeEventListener: vi.fn(),
      })),
    );
    renderRoster(team());
    expect(screen.getByRole('table')).toBeInTheDocument();

    matches = true;
    act(() => listener());

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Team members' })).toBeInTheDocument();
  });
});

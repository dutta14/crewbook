import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { TeamTenure } from './TeamTenure';

const names = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('rowheader').textContent);

const yearsAgo = (years: number) => {
  const day = new Date();
  day.setFullYear(day.getFullYear() - years);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
};

const TEAM = [
  createMember({ id: '1', name: 'Zoe Adams', startDate: yearsAgo(4) }),
  createMember({ id: '2', name: 'Abe Lin', startDate: yearsAgo(1) }),
  createMember({ id: '3', name: 'Mia Cole', startDate: yearsAgo(2) }),
  createMember({ id: '4', name: 'No Date', startDate: 'unknown' }),
];

describe('TeamTenure page', () => {
  it('shows the heading, moves focus to it and shows the average tenure', () => {
    renderWithProviders(<TeamTenure />, { initialData: { members: TEAM } });

    expect(screen.getByRole('heading', { level: 1, name: 'Team Tenure' })).toHaveFocus();
    // Zoe 4y, Mia 2y, Abe 1y: 7 years over three people is 2y 4m.
    expect(screen.getByRole('status', { name: /^Average team tenure/ })).toHaveAccessibleName(
      'Average team tenure: 2 years 4 months',
    );
    expect(screen.getByText('2y 4m')).toBeInTheDocument();
  });

  it('starts sorted by start date and leaves out members without a readable start date', () => {
    renderWithProviders(<TeamTenure />, { initialData: { members: TEAM } });

    expect(names()).toEqual(['Zoe Adams', 'Mia Cole', 'Abe Lin']);
  });

  it('re-sorts when the sort field changes', async () => {
    renderWithProviders(<TeamTenure />, { initialData: { members: TEAM } });

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Name');
    expect(names()).toEqual(['Abe Lin', 'Mia Cole', 'Zoe Adams']);

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Tenure length');
    expect(names()).toEqual(['Zoe Adams', 'Mia Cole', 'Abe Lin']);
  });

  it('keeps the sort order out of storage and the address', async () => {
    renderWithProviders(<TeamTenure />, { initialData: { members: TEAM } });

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Name');

    expect(window.localStorage.length).toBe(0);
    expect(window.location.search).toBe('');
  });

  it('shows an empty state and no stat when there is no team', () => {
    renderWithProviders(<TeamTenure />);

    expect(
      screen.getByRole('heading', { name: 'Add team members to see tenure data' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /^Average team tenure/ })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<TeamTenure />, { initialData: { members: TEAM } });

    expect(await axe(container)).toHaveNoViolations();
  });
});

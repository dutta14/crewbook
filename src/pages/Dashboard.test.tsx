import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMember, createNote } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { toIsoDate } from '../utils/scheduleCalculator';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('puts the digest under the page heading, with a level 2 heading so the hierarchy has no gap', () => {
    renderWithProviders(<Dashboard />);

    const levels = screen.getAllByRole('heading').map((heading) => heading.tagName);
    expect(levels).toEqual(['H1', 'H2', 'H3', 'H3']);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('No 1:1s scheduled today')).toBeInTheDocument();
  });

  it('shows who is overdue for a 1:1 under the digest', () => {
    const member = createMember({
      name: 'Alex Chen',
      schedule: { cadence: 'weekly', dayOfWeek: 'monday', time: '10:00', nextDate: '2030-01-07' },
    });
    const lastMet = new Date();
    lastMet.setDate(lastMet.getDate() - 20);

    renderWithProviders(<Dashboard />, {
      initialData: { members: [member] },
      initialPrivateData: {
        notes: [createNote({ memberId: member.id, createdAt: lastMet.toISOString() })],
      },
    });

    expect(screen.getByRole('region', { name: 'Overdue 1:1s' })).toHaveTextContent(
      'Last met 20 days ago',
    );
  });

  it('lists members stored with a 1:1 today', () => {
    const member = createMember({
      name: 'Alex Chen',
      schedule: {
        cadence: 'weekly',
        dayOfWeek: 'monday',
        time: '10:00',
        nextDate: toIsoDate(new Date()),
      },
    });

    renderWithProviders(<Dashboard />, { initialData: { members: [member] } });

    expect(screen.getByRole('link', { name: /Alex Chen/ })).toHaveAttribute(
      'href',
      `/person/${member.id}`,
    );
  });
});

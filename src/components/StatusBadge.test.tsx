import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { TeamMemberStatus } from '../types/TeamMember';
import { StatusBadge, toBadgeStatus, type StatusBadgeStatus } from './StatusBadge';

describe('StatusBadge', () => {
  it.each<[StatusBadgeStatus, string]>([
    ['active', 'Active'],
    ['on-leave', 'On leave'],
    ['departing', 'Departing'],
    ['new', 'New hire'],
  ])('renders the "%s" status as "%s"', (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toHaveClass(`status-badge--${status}`);
  });

  it('uses the md size by default', () => {
    render(<StatusBadge status="active" />);

    expect(screen.getByText('Active')).toHaveClass('status-badge--md');
  });

  it('applies the sm size when requested', () => {
    render(<StatusBadge status="active" size="sm" />);

    expect(screen.getByText('Active')).toHaveClass('status-badge--sm');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<StatusBadge status="departing" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('toBadgeStatus', () => {
  it.each<[TeamMemberStatus, StatusBadgeStatus]>([
    ['active', 'active'],
    ['on_leave', 'on-leave'],
    ['departing', 'departing'],
    ['new_hire', 'new'],
  ])('maps the stored "%s" status to the "%s" badge', (status, badge) => {
    expect(toBadgeStatus(status)).toBe(badge);
  });
});

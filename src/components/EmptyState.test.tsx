import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

const icon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="9" />
  </svg>
);

describe('EmptyState', () => {
  it('renders the title as a heading', () => {
    render(<EmptyState icon={icon} title="No team members yet" />);

    expect(screen.getByRole('heading', { name: 'No team members yet' })).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<EmptyState icon={icon} title="Empty" description="Add your first report." />);

    expect(screen.getByText('Add your first report.')).toBeInTheDocument();
  });

  it('hides the decorative icon from assistive technology', () => {
    const { container } = render(<EmptyState icon={icon} title="Empty" />);

    expect(container.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders no button when there is no action', () => {
    render(<EmptyState icon={icon} title="Empty" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a CTA that calls the action handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EmptyState icon={icon} title="Empty" action={{ label: 'Add member', onClick }} />);

    await user.click(screen.getByRole('button', { name: 'Add member' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a secondary action that calls its own handler', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <EmptyState
        icon={icon}
        title="Empty"
        action={{ label: 'Add member', onClick: onPrimary }}
        secondaryAction={{ label: 'Import CSV', onClick: onSecondary }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Import CSV' }));

    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <EmptyState
        icon={icon}
        title="No team members yet"
        description="Add your first report."
        action={{ label: 'Add member', onClick: vi.fn() }}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

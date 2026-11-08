import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'one', label: 'One', content: <p>First panel</p> },
  { id: 'two', label: 'Two', content: <p>Second panel</p> },
  { id: 'three', label: 'Three', content: <p>Third panel</p> },
];

describe('Tabs', () => {
  it('links each tab to its panel and only exposes the active panel', () => {
    render(<Tabs tabs={tabs} />);

    const tab = screen.getByRole('tab', { name: 'One' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'One' });
    expect(tab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('keeps inactive panels mounted but hidden', () => {
    render(<Tabs tabs={tabs} />);

    expect(screen.getByText('Second panel')).not.toBeVisible();
  });

  it('honours defaultActiveId and falls back to the first tab for an unknown id', () => {
    const { rerender } = render(<Tabs tabs={tabs} defaultActiveId="two" />);
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');

    rerender(<Tabs tabs={tabs.slice(0, 1)} defaultActiveId="two" />);
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps ArrowRight and ArrowLeft and supports Home and End', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} />);
    screen.getByRole('tab', { name: 'One' }).focus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus();
  });

  it('puts only the selected tab in the Tab order', () => {
    render(<Tabs tabs={tabs} />);

    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Tabs tabs={tabs} ariaLabel="Sections" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

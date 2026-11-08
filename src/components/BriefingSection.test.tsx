import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { BriefingSection } from './BriefingSection';

const KEY = 'dashboard-collapse-state';

const renderSection = (props: Partial<Parameters<typeof BriefingSection>[0]> = {}) =>
  render(
    <BriefingSection id="reminders" title="Reminders" count={2} {...props}>
      <p>Section body</p>
    </BriefingSection>,
  );

describe('BriefingSection', () => {
  it('is a region named by its h3 title, with a count that reads as items', () => {
    renderSection();

    const heading = screen.getByRole('heading', { level: 3, name: 'Reminders' });
    expect(screen.getByRole('region', { name: 'Reminders' })).toHaveAttribute(
      'aria-labelledby',
      heading.id,
    );
    expect(screen.getByRole('img', { name: '2 items' })).toHaveTextContent('2');
  });

  it('uses the singular for a count of one', () => {
    renderSection({ count: 1 });

    expect(screen.getByRole('img', { name: '1 item' })).toBeInTheDocument();
  });

  it('starts expanded, with the toggle wired to the content', () => {
    renderSection();

    const toggle = screen.getByRole('button', { name: 'Toggle Reminders' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toContainElement(
      screen.getByText('Section body'),
    );
  });

  it('collapses and expands with a click, and with the keyboard', async () => {
    const user = userEvent.setup();
    renderSection();
    const toggle = screen.getByRole('button', { name: 'Toggle Reminders' });

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Section body')).not.toBeVisible();

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Section body')).toBeVisible();
  });

  it('saves the state by section id and restores it on the next mount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSection();
    await user.click(screen.getByRole('button', { name: 'Toggle Reminders' }));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '')).toEqual({ reminders: true });
    unmount();

    renderSection();

    expect(screen.getByRole('button', { name: 'Toggle Reminders' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('can start collapsed, but a saved choice wins', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ reminders: false }));
    renderSection({ defaultCollapsed: true });

    expect(screen.getByRole('button', { name: 'Toggle Reminders' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('expands everything when the saved state is damaged', () => {
    window.localStorage.setItem(KEY, '{nope');
    renderSection();

    expect(screen.getByRole('button', { name: 'Toggle Reminders' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('has no accessibility violations open or collapsed', async () => {
    const { container } = renderSection();
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole('button', { name: 'Toggle Reminders' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('app renders without crashing', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('app shell has sidebar and main content area', () => {
    render(<App />);

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('sidebar contains navigation links', () => {
    render(<App />);

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const links = Array.from(nav.querySelectorAll('a')).map((link) => link.textContent);

    expect(links).toEqual(['Dashboard', 'Team', 'Calendar', 'Settings']);
  });

  it('dark mode toggle adds "dark" class to body', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Toggle dark mode' }));

    expect(document.body).toHaveClass('dark');
  });

  it('dark mode toggle removes "dark" class on second click', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Toggle dark mode' });

    await user.click(toggle);
    await user.click(toggle);

    expect(document.body).not.toHaveClass('dark');
  });

  it('dark mode preference persists across renders', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Toggle dark mode' }));
    unmount();
    document.body.className = '';

    render(<App />);

    expect(document.body).toHaveClass('dark');
  });

  it('dark mode toggle reports its pressed state', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Toggle dark mode' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the current page link with aria-current', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Team' })).not.toHaveAttribute('aria-current');
  });

  it('navigates to the roster route when Team is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Team' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Roster' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team' })).toHaveAttribute('aria-current', 'page');
  });

  it('redirects unknown routes to the dashboard', () => {
    window.location.hash = '#/does-not-exist';

    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('makes the skip link the first focusable element', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
  });

  it('moves focus to main content from the skip link without changing the route', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/roster';
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Skip to main content' }));

    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#/roster');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<App />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

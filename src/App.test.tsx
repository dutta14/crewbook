import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { setUpPassphrase } from './test-utils/unlockApp';

vi.mock('./utils/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/crypto')>();
  const { fastDeriveKey, fastDeriveSigningKey } = await import('./test-utils/fastCrypto');
  return { ...actual, deriveKey: fastDeriveKey, deriveSigningKey: fastDeriveSigningKey };
});

async function renderUnlocked() {
  const user = userEvent.setup();
  const view = render(<App />);
  await setUpPassphrase(user);
  return { user, ...view };
}

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('app renders without crashing', async () => {
    await renderUnlocked();

    expect(
      screen.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeInTheDocument();
  });

  it('app shell has sidebar and main content area', async () => {
    await renderUnlocked();

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('sidebar contains navigation links', async () => {
    await renderUnlocked();

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const links = Array.from(nav.querySelectorAll('a')).map((link) => link.textContent);

    expect(links).toEqual([
      'Dashboard',
      'Team',
      'Action Items',
      'Decisions & Follow-ups',
      'Feedback',
      'Tasks',
      'Calendar',
      'Settings',
    ]);
  });

  it('dark mode toggle adds "dark" class to body', async () => {
    const { user } = await renderUnlocked();

    await user.click(screen.getByRole('button', { name: 'Toggle dark mode' }));

    expect(document.body).toHaveClass('dark');
  });

  it('dark mode toggle removes "dark" class on second click', async () => {
    const { user } = await renderUnlocked();
    const toggle = screen.getByRole('button', { name: 'Toggle dark mode' });

    await user.click(toggle);
    await user.click(toggle);

    expect(document.body).not.toHaveClass('dark');
  });

  it('dark mode preference persists across renders', async () => {
    const { user, unmount } = await renderUnlocked();
    await user.click(screen.getByRole('button', { name: 'Toggle dark mode' }));
    unmount();
    document.body.className = '';

    render(<App />);
    await user.type(screen.getByLabelText('Passphrase', { exact: true }), 'test passphrase');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await screen.findByRole('navigation', { name: 'Main navigation' }, { timeout: 5000 });

    expect(document.body).toHaveClass('dark');
  });

  it('dark mode toggle reports its pressed state', async () => {
    const { user } = await renderUnlocked();
    const toggle = screen.getByRole('button', { name: 'Toggle dark mode' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the current page link with aria-current', async () => {
    await renderUnlocked();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Team' })).not.toHaveAttribute('aria-current');
  });

  it('navigates to the roster route when Team is clicked', async () => {
    const { user } = await renderUnlocked();

    await user.click(screen.getByRole('link', { name: 'Team' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team' })).toHaveAttribute('aria-current', 'page');
  });

  it('redirects unknown routes to the dashboard', async () => {
    window.location.hash = '#/does-not-exist';

    await renderUnlocked();

    expect(
      await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeInTheDocument();
  });

  it('makes the skip link the first focusable element', async () => {
    const { user } = await renderUnlocked();

    await user.tab();

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
  });

  it('moves focus to main content from the skip link without changing the route', async () => {
    window.location.hash = '#/roster';
    const { user } = await renderUnlocked();

    await user.click(screen.getByRole('link', { name: 'Skip to main content' }));

    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#/roster');
  });

  it('has no accessibility violations', async () => {
    const { container } = await renderUnlocked();

    expect(await axe(container)).toHaveNoViolations();
  });
});

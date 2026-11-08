import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { AppShell } from './AppShell';

function Boom(): never {
  throw new Error('boom');
}

function renderShell(route = '/') {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<h1>Home</h1>} />
        <Route path="broken" element={<Boom />} />
      </Route>
    </Routes>,
    { route },
  );
}

const openButton = () => screen.getByRole('button', { name: 'Open navigation' });

describe('AppShell mobile navigation', () => {
  it('starts with the navigation collapsed', () => {
    renderShell();

    expect(openButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands the navigation and moves focus into it when the hamburger is clicked', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(openButton());

    expect(openButton()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
  });

  it('closes the navigation and returns focus to the hamburger on Escape', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(openButton());

    await user.keyboard('{Escape}');

    expect(openButton()).toHaveAttribute('aria-expanded', 'false');
    expect(openButton()).toHaveFocus();
  });

  it('closes the navigation when the close button is clicked', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(openButton());

    await user.click(screen.getByRole('button', { name: 'Close navigation' }));

    expect(openButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the navigation and focuses the content after choosing a link', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(openButton());

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));

    expect(openButton()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('leaves focus alone when a link is clicked while the navigation is closed', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));

    expect(screen.getByRole('main')).not.toHaveFocus();
  });
});

describe('AppShell error handling', () => {
  it('shows the fallback in the content area while the sidebar stays usable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderShell('/broken');

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('clears the fallback after navigating to another route', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderShell('/broken');

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AppShell accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = renderShell();

    expect(await axe(container)).toHaveNoViolations();
  });
});

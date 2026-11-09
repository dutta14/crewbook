import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Dashboard } from '../pages/Dashboard';
import { Roster } from '../pages/Roster';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { AppShell } from './AppShell';

const ALEX = createMember({ id: '11111111-1111-4111-8111-111111111111', name: 'Alex Chen' });
const PRIYA = createMember({ id: '22222222-2222-4222-8222-222222222222', name: 'Priya Nair' });

const dialog = () => screen.getByRole('dialog', { name: 'Log feedback' });
const personField = () => within(dialog()).getByRole('combobox', { name: /Person/ });

describe('quick-add feedback', () => {
  it('opens from the dashboard with nobody chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />, { initialData: { members: [ALEX, PRIYA] } });

    await user.click(await screen.findByRole('button', { name: 'Log feedback' }));

    expect(personField()).toHaveValue('');
  });

  it('opens from a roster row with that person chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Roster />, { initialData: { members: [ALEX, PRIYA] } });

    await user.click(screen.getByRole('button', { name: 'Log feedback for Priya Nair' }));

    expect(personField()).toHaveValue(PRIYA.id);
  });

  it('saves from the roster without leaving it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Roster />, { initialData: { members: [ALEX] } });

    await user.click(screen.getByRole('button', { name: 'Log feedback for Alex Chen' }));
    await user.type(
      within(dialog()).getByRole('textbox', { name: /What did you observe/ }),
      'Quiet but sharp in review',
    );
    await user.click(within(dialog()).getByRole('button', { name: 'Save feedback' }));

    expect(await screen.findByText('Feedback logged')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument();
  });

  describe('floating button', () => {
    const renderShell = (route: string) =>
      renderWithProviders(
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<h1>Home</h1>} />
            <Route path="person/:id" element={<h1>Profile</h1>} />
          </Route>
        </Routes>,
        { route, initialData: { members: [ALEX, PRIYA] } },
      );

    it('opens from any screen without a person chosen', async () => {
      const user = userEvent.setup();
      renderShell('/');

      await user.click(screen.getByRole('button', { name: 'Log feedback' }));

      expect(personField()).toHaveValue('');
    });

    it('starts with the person whose profile is open', async () => {
      const user = userEvent.setup();
      renderShell(`/person/${ALEX.id}`);

      await user.click(screen.getByRole('button', { name: 'Log feedback' }));

      expect(personField()).toHaveValue(ALEX.id);
    });

    it('ignores a profile id that is not a person id', async () => {
      const user = userEvent.setup();
      renderShell('/person/not-an-id');

      await user.click(screen.getByRole('button', { name: 'Log feedback' }));

      expect(personField()).toHaveValue('');
    });
  });
});

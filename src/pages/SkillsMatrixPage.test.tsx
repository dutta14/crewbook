import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMember, createSkill } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { SkillsMatrixPage } from './SkillsMatrixPage';

const envelope = vi.hoisted(() => ({ state: { isReady: true, loadFailed: false } }));

vi.mock('../hooks/usePrivateEnvelope', () => ({
  usePrivateEnvelope: () => envelope.state,
}));

const ZOE = createMember({ id: 'zoe', name: 'Zoe Park' });
const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });

beforeEach(() => {
  envelope.state = { isReady: true, loadFailed: false };
});

const renderPage = (skills: unknown[] = []) =>
  renderWithProviders(<SkillsMatrixPage />, {
    initialData: { members: [ZOE, ALEX] },
    initialPrivateData: { skills },
  });

describe('SkillsMatrixPage', () => {
  it('moves focus to the page heading on arrival', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Skills Matrix' })).toHaveFocus();
  });

  it('lists team members alphabetically with their skills', () => {
    renderPage([
      createSkill({ memberId: ZOE.id, name: 'Go', level: 'expert' }),
      createSkill({ memberId: ALEX.id, name: 'Go', level: 'learning' }),
    ]);

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Alex Chen');
    expect(rows[0]).toHaveTextContent('Learning');
    expect(rows[1]).toHaveTextContent('Zoe Park');
    expect(rows[1]).toHaveTextContent('Expert');
  });

  it('shows the empty state when no skill is documented', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'No skills documented yet' })).toBeInTheDocument();
  });

  it('shows no skill while the private envelope is still opening', () => {
    envelope.state = { isReady: false, loadFailed: false };

    renderPage([createSkill({ memberId: ZOE.id, name: 'Go' })]);

    expect(screen.getByText('Opening skills…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('tells the manager when the private envelope could not be opened', () => {
    envelope.state = { isReady: false, loadFailed: true };

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open skills");
  });
});

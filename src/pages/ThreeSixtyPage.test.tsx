import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createConnection, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { ThreeSixtyPage } from './ThreeSixtyPage';

const envelope = vi.hoisted(() => ({ state: { isReady: true, loadFailed: false } }));

vi.mock('../hooks/usePrivateEnvelope', () => ({
  usePrivateEnvelope: () => envelope.state,
}));

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

const renderPage = () =>
  renderWithProviders(<ThreeSixtyPage />, {
    initialData: { members: [ALEX, PRIYA] },
    initialPrivateData: {
      connections: [
        createConnection({
          sourceMemberId: ALEX.id,
          targetMemberId: PRIYA.id,
          targetName: PRIYA.name,
          relationship: 'collaborator',
        }),
      ],
    },
  });

beforeEach(() => {
  envelope.state = { isReady: true, loadFailed: false };
});

describe('ThreeSixtyPage', () => {
  it('moves focus to the heading and starts with nobody chosen', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: '360 Planning' })).toHaveFocus();
    expect(screen.getByLabelText('Select team member')).toHaveValue('');
  });

  it('plans from the stored connections of the chosen person', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText('Select team member'), 'Alex Chen');

    expect(screen.getByText('1 reviewer selected')).toBeInTheDocument();
  });

  it('waits for the private data to open', () => {
    envelope.state = { isReady: false, loadFailed: false };
    renderPage();

    expect(screen.getByText('Opening connections…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Select team member')).toBeNull();
  });
});

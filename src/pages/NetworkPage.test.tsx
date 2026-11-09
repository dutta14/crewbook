import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConnection, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { NetworkPage } from './NetworkPage';

const envelope = vi.hoisted(() => ({ state: { isReady: true, loadFailed: false } }));

vi.mock('../hooks/usePrivateEnvelope', () => ({
  usePrivateEnvelope: () => envelope.state,
}));

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const SAM = createMember({ id: 'sam', name: 'Sam Okoye' });

const CONNECTIONS = [
  createConnection({
    sourceMemberId: ALEX.id,
    targetMemberId: PRIYA.id,
    targetName: PRIYA.name,
    relationship: 'collaborator',
  }),
  createConnection({
    sourceMemberId: SAM.id,
    targetMemberId: null,
    targetName: 'Jo Rivera',
    relationship: 'stakeholder',
  }),
];

const setNarrow = (isNarrow: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: isNarrow && query.includes('max-width'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

const renderPage = (connections: unknown[] = CONNECTIONS) =>
  renderWithProviders(<NetworkPage />, {
    initialData: { members: [ALEX, PRIYA, SAM] },
    initialPrivateData: { connections },
  });

beforeEach(() => {
  envelope.state = { isReady: true, loadFailed: false };
  setNarrow(false);
});

afterEach(() => vi.unstubAllGlobals());

describe('NetworkPage', () => {
  it('moves focus to the heading and warns that the data is sensitive', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Network' })).toHaveFocus();
    expect(screen.getByText('Contains sensitive relationship data')).toBeInTheDocument();
  });

  it('shows the graph and a list alternative on wide screens', () => {
    renderPage();

    expect(screen.getByRole('img', { name: 'Team connection network graph' })).toBeInTheDocument();
    expect(screen.getByText('Show connections as a list')).toBeInTheDocument();
  });

  it('draws team members as nodes and leaves cross-team peers to the list', () => {
    renderPage();

    expect(screen.getAllByTestId(/^graph-node-/)).toHaveLength(3);
    expect(screen.getByText('Jo Rivera').closest('svg')).toBeNull();
  });

  it('shows only the list below 768px', () => {
    setNarrow(true);
    renderPage();

    expect(screen.queryByRole('img', { name: 'Team connection network graph' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Alex Chen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sam Okoye' })).toBeInTheDocument();
  });

  it('lists each person with their connections in the list view', () => {
    setNarrow(true);
    renderPage();

    const alex = screen.getByRole('heading', { name: 'Alex Chen' }).closest('section');
    expect(alex).not.toBeNull();
    expect(within(alex as HTMLElement).getByText('Priya Nair')).toBeInTheDocument();
    expect(within(alex as HTMLElement).getByText('Collaborator')).toBeInTheDocument();
  });

  it('shows the empty state and a way to the team when nothing is connected', async () => {
    const user = userEvent.setup();
    renderPage([]);

    expect(screen.getByRole('heading', { name: 'No connections yet' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to team' }));
  });

  it('waits for the private data to open before showing anything', () => {
    envelope.state = { isReady: false, loadFailed: false };
    renderPage();

    expect(screen.getByText('Opening connections…')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('says so when the private data could not be opened', () => {
    envelope.state = { isReady: false, loadFailed: true };
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open connections");
  });
});

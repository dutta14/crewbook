import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { ShareToken } from '../types/sharing';
import { ActiveTokensList } from './ActiveTokensList';

const HOUR = 60 * 60 * 1000;

const token = (id: string, hoursLeft: number, overrides: Partial<ShareToken> = {}): ShareToken => ({
  id,
  engineerId: 'alex',
  createdAt: new Date(Date.now() + hoursLeft * HOUR - 24 * HOUR).toISOString(),
  expiresAt: new Date(Date.now() + hoursLeft * HOUR).toISOString(),
  revoked: false,
  ttl: '24h',
  ...overrides,
});

function Stored() {
  const storage = useEncryptedStorage();
  const tokens = storage.get<ShareToken[]>('shareTokens') ?? [];
  return (
    <output data-testid="stored">{tokens.map((t) => `${t.id}:${t.revoked}`).join(',')}</output>
  );
}

function setup(tokens: ShareToken[]) {
  const user = userEvent.setup();
  const view = renderWithProviders(
    <>
      <ActiveTokensList memberId="alex" />
      <Stored />
    </>,
    { initialData: { shareTokens: tokens } },
  );
  return { user, ...view };
}

describe('ActiveTokensList', () => {
  it('says there are no active links when there are none', () => {
    setup([]);

    expect(screen.getByRole('heading', { name: 'Active share links' })).toBeInTheDocument();
    expect(screen.getByText('No active share links.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('lists each live link with a short id and the time it has left, soonest first', () => {
    setup([
      token('bbbbbbbb-2222', 5),
      token('aaaaaaaa-1111', 2),
      token('cccccccc-3333', 3, { engineerId: 'priya' }),
      token('dddddddd-4444', 3, { revoked: true }),
      token('eeeeeeee-5555', -2),
    ]);

    const table = screen.getByRole('table', { name: 'Active share links' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('aaaaaaaa');
    expect(rows[0]).toHaveTextContent('Expires in 2 hours');
    expect(rows[1]).toHaveTextContent('bbbbbbbb');
    expect(rows[1]).toHaveTextContent('Expires in 5 hours');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Link', 'Expires', 'Actions']);
  });

  it('counts down in minutes inside the last hour', () => {
    setup([token('aaaaaaaa-1111', 0.5)]);

    expect(screen.getByText('Expires in 30 minutes')).toBeInTheDocument();
  });

  it('asks before revoking and says what it does', async () => {
    const { user } = setup([token('aaaaaaaa-1111', 5)]);

    await user.click(screen.getByRole('button', { name: 'Revoke share link aaaaaaaa' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'This will immediately revoke access for anyone with this link.',
    );
    expect(screen.getByTestId('stored')).toHaveTextContent('aaaaaaaa-1111:false');
  });

  it('keeps the link when the manager cancels', async () => {
    const { user } = setup([token('aaaaaaaa-1111', 5)]);
    await user.click(screen.getByRole('button', { name: 'Revoke share link aaaaaaaa' }));

    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(screen.getByTestId('stored')).toHaveTextContent('aaaaaaaa-1111:false');
    expect(screen.getByRole('button', { name: 'Revoke share link aaaaaaaa' })).toBeInTheDocument();
  });

  it('revokes the link, removes its row and moves focus to the heading', async () => {
    const { user } = setup([token('aaaaaaaa-1111', 5), token('bbbbbbbb-2222', 6)]);
    await user.click(screen.getByRole('button', { name: 'Revoke share link aaaaaaaa' }));

    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revoke link' }),
    );

    expect(await screen.findByText('Link revoked')).toBeInTheDocument();
    expect(screen.getByTestId('stored')).toHaveTextContent(
      'aaaaaaaa-1111:true,bbbbbbbb-2222:false',
    );
    expect(
      screen.queryByRole('button', { name: 'Revoke share link aaaaaaaa' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke share link bbbbbbbb' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active share links' })).toHaveFocus();
  });

  it('shows no violations an accessibility checker can find', async () => {
    const { container } = setup([token('aaaaaaaa-1111', 0.5), token('bbbbbbbb-2222', 5)]);

    expect(await axe(container)).toHaveNoViolations();
  });
});

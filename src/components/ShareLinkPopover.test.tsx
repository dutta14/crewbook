import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createMember, createNote } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { ShareToken } from '../types/sharing';
import { copyWithAutoClear } from '../utils/clipboard';
import { readShareToken } from '../utils/shareUrl';
import { ShareLinkPopover } from './ShareLinkPopover';

vi.mock('../utils/clipboard', () => ({ copyWithAutoClear: vi.fn(async () => undefined) }));

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const HOUR = 60 * 60 * 1000;

const newKey = () =>
  crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

function Tokens() {
  const storage = useEncryptedStorage();
  const tokens = storage.get<ShareToken[]>('shareTokens') ?? [];
  return <output data-testid="tokens">{tokens.map((t) => `${t.ttl}`).join(',')}</output>;
}

async function setup(agenda: unknown[] = [], extraMembers: ReturnType<typeof createMember>[] = []) {
  const key = await newKey();
  const user = userEvent.setup();
  const view = renderWithProviders(
    <>
      <ShareLinkPopover member={ALEX} onClose={() => undefined} />
      <Tokens />
    </>,
    {
      initialData: { members: [ALEX, ...extraMembers], settings: { managerName: 'Morgan Lee' } },
      initialPrivateData: {
        agendaItems: agenda,
        notes: [
          createNote({ id: 'n1', memberId: 'alex', content: 'Shared', visibility: 'shared' }),
        ],
      },
      signingKey: key,
    },
  );
  const dialog = await screen.findByRole('dialog', { name: 'Share 1:1 with Alex Chen' });
  return { user, key, dialog, ...view };
}

const reveal = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
  await user.click(await within(dialog).findByRole('button', { name: 'I understand' }));
  return within(dialog).getByRole('textbox', { name: 'Share link' }) as HTMLInputElement;
};

const lifetimeOf = async (url: string, key: CryptoKey) => {
  const payload = await readShareToken(url, key);
  if (!payload) throw new Error('link did not decode');
  return Date.parse(payload.expiresAt) - Date.parse(payload.createdAt);
};

beforeEach(() => {
  vi.mocked(copyWithAutoClear).mockClear();
});

describe('ShareLinkPopover', () => {
  const topic = (text: string, overrides: Record<string, unknown> = {}) => ({
    id: text,
    memberId: 'alex',
    text,
    addedBy: 'manager',
    createdAt: '2026-01-05T09:00:00Z',
    includeInShare: true,
    ...overrides,
  });

  it('warns before sharing when an agenda item names another team member', async () => {
    const priya = createMember({ id: 'priya', name: 'Priya Nair' });
    const { dialog } = await setup([topic('Ask Priya Nair about the launch')], [priya]);

    expect(
      await within(dialog).findByText(
        'Some agenda items may reference other team members. Review before sharing.',
      ),
    ).toBeInTheDocument();
  });

  it('warns about an @mention', async () => {
    const { dialog } = await setup([topic('Loop in @sam')]);

    expect(await within(dialog).findByText(/may reference other team members/)).toBeInTheDocument();
  });

  it('does not warn for plain topics, or for a mention in an item that is not shared', async () => {
    const { dialog } = await setup([
      topic('Career growth'),
      topic('Loop in @sam', { includeInShare: false }),
    ]);

    await within(dialog).findByRole('button', { name: 'I understand' });
    expect(within(dialog).queryByText(/may reference other team members/)).not.toBeInTheDocument();
  });

  it('offers the four lifetimes and starts on 24 hours', async () => {
    const { dialog } = await setup();

    const select = within(dialog).getByRole('combobox', { name: 'Expires in' });
    expect(select).toHaveValue('24h');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['1 hour', '6 hours', '24 hours', '48 hours']);
  });

  it('makes a 24-hour link by default', async () => {
    const { user, key, dialog } = await setup();

    const input = await reveal(user, dialog);

    expect(await lifetimeOf(input.value, key)).toBe(24 * HOUR);
  });

  it('makes a new link with the chosen lifetime and keeps it on show', async () => {
    const { user, key, dialog } = await setup();
    await reveal(user, dialog);

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Expires in' }), '1h');

    const input = (await within(dialog).findByRole('textbox', {
      name: 'Share link',
    })) as HTMLInputElement;
    expect(await lifetimeOf(input.value, key)).toBe(HOUR);
    expect(within(dialog).queryByRole('button', { name: 'I understand' })).not.toBeInTheDocument();
  });

  it('lists a link only once the manager has seen it', async () => {
    const { user, dialog } = await setup();
    await within(dialog).findByRole('button', { name: 'I understand' });
    expect(screen.getByTestId('tokens')).toBeEmptyDOMElement();

    await reveal(user, dialog);

    expect(screen.getByTestId('tokens')).toHaveTextContent('24h');
  });

  it('lists every link made, so an earlier one can still be revoked', async () => {
    const { user, dialog } = await setup();
    await reveal(user, dialog);

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Expires in' }), '6h');
    await within(dialog).findByRole('textbox', { name: 'Share link' });

    expect(screen.getByTestId('tokens')).toHaveTextContent('24h,6h');
  });

  it('keeps the QR code hidden until asked, then shows it with the full link as its label', async () => {
    const { user, dialog } = await setup();
    const input = await reveal(user, dialog);
    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument();

    const toggle = within(dialog).getByRole('button', { name: 'Show QR code' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(
      within(dialog).getByRole('img', { name: `QR code linking to ${input.value}` }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/This QR code contains your 1:1 data\. Do not photograph it/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Hide QR code' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('hides the QR code again when the link is replaced', async () => {
    const { user, dialog } = await setup();
    await reveal(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Show QR code' }));

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Expires in' }), '48h');
    await within(dialog).findByRole('textbox', { name: 'Share link' });

    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument();
  });

  it('announces a copied link politely', async () => {
    const { user, dialog } = await setup();
    await reveal(user, dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Copy link' }));

    const status = await within(dialog).findByText('Link copied');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('shows no violations an accessibility checker can find with the link and QR code open', async () => {
    const { user, dialog } = await setup();
    await reveal(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Show QR code' }));

    expect(await axe(dialog)).toHaveNoViolations();
  });
});

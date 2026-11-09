import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createActionItem, createMember, createNote } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { copyWithAutoClear } from '../utils/clipboard';
import { readShareToken } from '../utils/shareUrl';
import { ShareButton } from './ShareButton';

vi.mock('../utils/clipboard', () => ({ copyWithAutoClear: vi.fn(async () => undefined) }));

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const SECRET = 'SENTINEL-SECRET';

const newKey = () =>
  crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

function Probe() {
  const storage = useEncryptedStorage();
  return (
    <output data-testid="saved-manager-name">
      {storage.get<Record<string, string>>('settings')?.managerName}
    </output>
  );
}

const privateData = () => ({
  notes: [
    createNote({ id: 'n1', memberId: 'alex', content: 'Shared note', visibility: 'shared' }),
    createNote({ id: 'n2', memberId: 'alex', content: `Hidden ${SECRET}`, visibility: 'private' }),
    createNote({ id: 'n3', memberId: 'alex', content: `Unmarked ${SECRET}` }),
    createNote({ id: 'n4', memberId: 'priya', content: `Other ${SECRET}`, visibility: 'shared' }),
  ],
  actionItems: [createActionItem({ id: 'a1', memberId: 'alex', title: 'Ship it' })],
  moods: [{ memberId: 'alex', score: 1, note: SECRET }],
});

async function setup({
  managerName,
  signingKey,
}: { managerName?: string; signingKey?: CryptoKey | null } = {}) {
  const key = signingKey === undefined ? await newKey() : signingKey;
  const user = userEvent.setup();
  renderWithProviders(
    <>
      <ShareButton member={ALEX} />
      <Probe />
    </>,
    {
      initialData: {
        members: [ALEX, PRIYA],
        settings: managerName ? { managerName } : {},
      },
      initialPrivateData: privateData(),
      signingKey: key,
    },
  );
  return { user, key };
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Share 1:1' }));
  return screen.findByRole('dialog', { name: 'Share 1:1 with Alex Chen' });
};

const reveal = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
  await user.click(await within(dialog).findByRole('button', { name: 'I understand' }));
  return within(dialog).getByRole('textbox', { name: 'Share link' }) as HTMLInputElement;
};

beforeEach(() => {
  vi.mocked(copyWithAutoClear).mockClear();
  vi.mocked(copyWithAutoClear).mockResolvedValue(undefined);
});

describe('ShareButton', () => {
  it('renders a Share 1:1 button that opens a dialog', async () => {
    const { user } = await setup();

    expect(await openDialog(user)).toBeInTheDocument();
  });

  it('creates a link straight away when the manager name is already saved, behind a warning', async () => {
    const { user } = await setup({ managerName: 'Morgan Lee' });
    const dialog = await openDialog(user);

    const warning = await within(dialog).findByRole('alert');
    expect(warning).toHaveTextContent(
      'This link contains your 1:1 data. Share it only with your direct report.',
    );
    expect(within(dialog).queryByRole('textbox', { name: 'Share link' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();

    const input = await reveal(user, dialog);
    expect(input.value).toContain('#/shared/');
    expect(input).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('puts only the shared notes and this person’s action items in the link', async () => {
    const { user, key } = await setup({ managerName: 'Morgan Lee' });
    const dialog = await openDialog(user);
    const input = await reveal(user, dialog);

    const payload = await readShareToken(input.value, key);
    expect(payload?.engineerName).toBe('Alex Chen');
    expect(payload?.managerName).toBe('Morgan Lee');
    expect(payload?.sharedNotes.map((note) => note.text)).toEqual(['Shared note']);
    expect(payload?.actionItems.map((item) => item.title)).toEqual(['Ship it']);
    expect(input.value).not.toContain(SECRET);
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    expect(JSON.stringify(payload)).not.toContain('Priya');
  });

  it('asks for the manager name first, remembers it and then shows the link', async () => {
    const { user } = await setup();
    const dialog = await openDialog(user);

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'Your name' }), '  Morgan Lee ');
    await user.click(within(dialog).getByRole('button', { name: 'Create link' }));

    await reveal(user, dialog);
    await waitFor(() =>
      expect(screen.getByTestId('saved-manager-name')).toHaveTextContent('Morgan Lee'),
    );
  });

  it('asks for a name when it is blank', async () => {
    const { user } = await setup();
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Create link' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Enter your name');
  });

  it('makes a different link each time one is created', async () => {
    const { user, key } = await setup({ managerName: 'Morgan Lee' });
    const dialog = await openDialog(user);
    const first = (await reveal(user, dialog)).value;

    await user.click(within(dialog).getByRole('button', { name: 'Create new link' }));
    const second = (await reveal(user, dialog)).value;

    expect(second).not.toBe(first);
    expect((await readShareToken(first, key))?.id).not.toBe(
      (await readShareToken(second, key))?.id,
    );
  });

  it('drops the link when the name changes', async () => {
    const { user } = await setup({ managerName: 'Morgan Lee' });
    const dialog = await openDialog(user);
    await reveal(user, dialog);

    await user.type(within(dialog).getByRole('textbox', { name: 'Your name' }), 'x');

    expect(within(dialog).queryByRole('textbox', { name: 'Share link' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('copies the link and says so', async () => {
    const { user } = await setup({ managerName: 'Morgan Lee' });
    const dialog = await openDialog(user);
    const input = await reveal(user, dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Copy link' }));

    expect(copyWithAutoClear).toHaveBeenCalledWith(input.value);
    expect(await within(dialog).findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('tells the manager when copying fails', async () => {
    vi.mocked(copyWithAutoClear).mockRejectedValue(new Error('denied'));
    const { user } = await setup({ managerName: 'Morgan Lee' });
    const dialog = await openDialog(user);
    await reveal(user, dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText(/Could not copy the link/)).toBeInTheDocument();
  });

  it('explains that the link is a snapshot and when it expires', async () => {
    const { user } = await setup({ managerName: 'Morgan Lee' });
    const dialog = await openDialog(user);
    await reveal(user, dialog);

    expect(
      within(dialog).getByText(/Anything you change later is not included/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Expires\s.*About \d+ KB/)).toBeInTheDocument();
  });

  it('refuses to create a link while the app is locked', async () => {
    const { user } = await setup({ managerName: 'Morgan Lee', signingKey: null });
    const dialog = await openDialog(user);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Unlock Crewbook to create a share link',
    );
    expect(within(dialog).queryByRole('textbox', { name: 'Share link' })).not.toBeInTheDocument();
  });

  it('closes with the Close button and Escape', async () => {
    const { user } = await setup();
    await openDialog(user);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await openDialog(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows no violations an accessibility checker can find', async () => {
    const { user } = await setup({ managerName: 'Morgan Lee' });
    const dialog = await openDialog(user);
    await reveal(user, dialog);

    expect(await axe(document.body)).toHaveNoViolations();
  });
});

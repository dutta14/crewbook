import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { makePayload } from '../test-utils/sharePayload';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { SharedViewPayload } from '../types/sharing';
import { createShareToken } from '../utils/shareUrl';
import { SharedOneOnOne } from './SharedOneOnOne';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const newKey = () =>
  crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

async function renderShared(
  overrides: Partial<SharedViewPayload> = {},
  { token, signingKey = null }: { token?: string; signingKey?: CryptoKey | null } = {},
) {
  const encoded =
    token ??
    (await createShareToken(makePayload({ expiresAt: FUTURE, ...overrides }), await newKey()));
  return renderWithProviders(
    <Routes>
      <Route path="/shared/:token?" element={<SharedOneOnOne />} />
    </Routes>,
    { route: encoded === '' ? '/shared' : `/shared/${encoded}`, signingKey },
  );
}

describe('SharedOneOnOne', () => {
  it('shows the manager in the page heading and landmark', async () => {
    await renderShared();

    expect(
      await screen.findByRole('heading', { level: 1, name: '1:1 with Morgan Lee' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('main', { name: '1:1 shared view with Morgan Lee' }),
    ).toBeInTheDocument();
  });

  it('shows the engineer avatar and name', async () => {
    await renderShared();

    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('img', { name: 'Alice Park' })).toHaveTextContent('AP');
    expect(screen.getByText('Alice Park')).toBeInTheDocument();
  });

  it('lists the shared notes with their dates', async () => {
    await renderShared({
      sharedNotes: [
        { id: 'n1', text: 'Talked about the launch', createdAt: '2026-01-07T10:00:00Z' },
        { id: 'n2', text: 'Career goals', createdAt: '2026-01-08T10:00:00Z' },
      ],
    });

    const list = await screen.findByRole('list', { name: 'Shared notes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Talked about the launch')).toBeInTheDocument();
    expect(within(list).getAllByText(/2026/)).toHaveLength(2);
  });

  it('shows note text as plain text, never as markup', async () => {
    await renderShared({
      sharedNotes: [
        {
          id: 'n1',
          text: '<img src=x onerror=alert(1)> **bold**',
          createdAt: '2026-01-07T10:00:00Z',
        },
      ],
    });

    const list = await screen.findByRole('list', { name: 'Shared notes' });
    expect(list.querySelector('img')).toBeNull();
    expect(list).toHaveTextContent('<img src=x onerror=alert(1)> **bold**');
  });

  it('shows each action item with its owner, due date and a read-only checkbox', async () => {
    await renderShared({
      actionItems: [
        {
          id: 'a1',
          title: 'Write the doc',
          status: 'open',
          owner: 'engineer',
          dueDate: '2999-01-01',
        },
        { id: 'a2', title: 'Book the room', status: 'done', owner: 'manager' },
      ],
    });

    const list = await screen.findByRole('list', { name: 'Action items' });
    const open = screen.getByRole('checkbox', { name: 'Write the doc' });
    const done = screen.getByRole('checkbox', { name: 'Book the room' });
    expect(open).toBeDisabled();
    expect(open).not.toBeChecked();
    expect(done).toBeDisabled();
    expect(done).toBeChecked();
    expect(within(list).getByLabelText('Assigned to You')).toHaveTextContent('You');
    expect(within(list).getByLabelText('Assigned to Morgan Lee')).toHaveTextContent('Morgan Lee');
    expect(within(list).getByText(/^Due .*2999/)).toBeInTheDocument();
  });

  it('marks an open item past its due date as overdue and a done one as not', async () => {
    await renderShared({
      actionItems: [
        { id: 'a1', title: 'Late', status: 'open', owner: 'engineer', dueDate: '2000-01-01' },
        {
          id: 'a2',
          title: 'Finished late',
          status: 'done',
          owner: 'engineer',
          dueDate: '2000-01-01',
        },
        { id: 'a3', title: 'On time', status: 'open', owner: 'engineer', dueDate: '2999-01-01' },
      ],
    });

    const [late, finished, onTime] = (await screen.findAllByText(/^Due /)).map((el) => el);
    expect(late).toHaveClass('shared-view__due--overdue');
    expect(late).toHaveTextContent('(overdue)');
    expect(finished).not.toHaveClass('shared-view__due--overdue');
    expect(onTime).not.toHaveClass('shared-view__due--overdue');
    expect(screen.getAllByText('(overdue)', { exact: false })).toHaveLength(1);
  });

  it('shows agenda items with their text, who added them and when', async () => {
    await renderShared({
      agendaItems: [
        {
          id: 'g1',
          text: 'Promo timeline',
          addedBy: 'engineer',
          createdAt: '2026-01-05T09:00:00Z',
        },
        { id: 'g2', text: 'Team offsite', addedBy: 'manager', createdAt: '2026-01-06T09:00:00Z' },
      ],
    });

    const list = await screen.findByRole('list', { name: 'Agenda items' });
    expect(within(list).getByText('Promo timeline')).toBeInTheDocument();
    expect(within(list).getByText(/Added by you/)).toBeInTheDocument();
    expect(within(list).getByText(/Added by Morgan Lee/)).toBeInTheDocument();
    expect(within(list).getAllByText(/2026/)).toHaveLength(2);
  });

  it('has no navigation, no controls to add anything and no other people', async () => {
    await renderShared();

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Priya');
  });

  it('shows an empty state in each section that has nothing to show, without a call to action', async () => {
    await renderShared({ sharedNotes: [], actionItems: [], agendaItems: [] });

    expect(await screen.findByText('No shared notes yet.')).toBeInTheDocument();
    expect(screen.getByText('No action items yet.')).toBeInTheDocument();
    expect(screen.getByText('No agenda items yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('gives each section an h2 under the h1', async () => {
    await renderShared();

    await screen.findByRole('heading', { level: 1 });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Shared notes', 'Action items', 'Agenda']);
  });

  it('moves focus to the agenda from the skip link without changing the address', async () => {
    const user = userEvent.setup();
    await renderShared();

    await user.click(await screen.findByRole('link', { name: 'Skip to agenda' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Agenda' })).toHaveFocus();
  });

  it('sets a neutral page title and restores the old one on leaving', async () => {
    document.title = 'Crewbook';
    const { unmount } = await renderShared();

    await waitFor(() => expect(document.title).toBe('1:1 Notes'));
    unmount();
    expect(document.title).toBe('Crewbook');
  });

  it('shows no violations an accessibility checker can find', async () => {
    const { container } = await renderShared({
      actionItems: [
        { id: 'a1', title: 'Late', status: 'open', owner: 'engineer', dueDate: '2000-01-01' },
      ],
      agendaItems: [
        {
          id: 'g1',
          text: 'Promo timeline',
          addedBy: 'engineer',
          createdAt: '2026-01-05T09:00:00Z',
        },
      ],
    });

    await screen.findByRole('heading', { level: 1 });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('SharedOneOnOne with a link that cannot be used', () => {
  const expectNoData = () => {
    expect(document.body).not.toHaveTextContent('Alice Park');
    expect(document.body).not.toHaveTextContent('Morgan Lee');
    expect(document.body).not.toHaveTextContent('launch');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  };

  it('shows the expired page, and none of the data, once the link has expired', async () => {
    await renderShared({ expiresAt: PAST });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This link has expired' }),
    ).toBeInTheDocument();
    expectNoData();
  });

  it.each([
    ['garbage', 'not-a-token'],
    ['a token with no signature', 'AAAA'],
    ['markup', '%3Cscript%3Ealert(1)%3C%2Fscript%3E'],
  ])('shows the invalid page for %s', async (_name, token) => {
    await renderShared({}, { token });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'This link is invalid or has been tampered with',
      }),
    ).toBeInTheDocument();
    expectNoData();
  });

  it('shows the invalid page when there is no token at all', async () => {
    await renderShared({}, { token: '' });

    expect(
      await screen.findByRole('heading', { level: 1, name: /This link is invalid/ }),
    ).toBeInTheDocument();
  });

  it('shows the invalid page for an altered payload when the signing key is known', async () => {
    const key = await newKey();
    const token = await createShareToken(makePayload({ expiresAt: FUTURE }), key);
    const altered = `${token.slice(0, 4)}${token[4] === 'A' ? 'B' : 'A'}${token.slice(5)}`;

    await renderShared({}, { token: altered, signingKey: key });

    expect(
      await screen.findByText('This link is invalid or has been tampered with'),
    ).toBeInTheDocument();
    expectNoData();
  });

  it('renders a signed link when the signing key matches', async () => {
    const key = await newKey();
    const token = await createShareToken(makePayload({ expiresAt: FUTURE }), key);

    await renderShared({}, { token, signingKey: key });

    expect(
      await screen.findByRole('heading', { level: 1, name: '1:1 with Morgan Lee' }),
    ).toBeInTheDocument();
  });

  it('shows no violations an accessibility checker can find on the error page', async () => {
    const { container } = await renderShared({ expiresAt: PAST });

    await screen.findByRole('heading', { level: 1 });
    expect(await axe(container)).toHaveNoViolations();
  });
});

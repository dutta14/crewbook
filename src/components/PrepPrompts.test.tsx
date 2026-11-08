import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPrepDismissed } from '../data/prepDismissal';
import { createActionItem, createMember, createNote } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { MemberChange } from '../types/Timeline';
import type { TeamMember } from '../types/TeamMember';
import { PrepPrompts } from './PrepPrompts';

const ALEX = '11111111-1111-4111-8111-111111111111';
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

const WEEKLY = {
  cadence: 'weekly',
  dayOfWeek: 'monday',
  time: '10:00',
  nextDate: '2099-01-05',
} as const;

interface Options {
  lastMetDaysAgo?: number | null;
  lastNote?: string;
  items?: string[];
  history?: MemberChange[];
  member?: Partial<TeamMember>;
}

function renderPrep({
  lastMetDaysAgo = 3,
  lastNote = 'Talked about the launch plan',
  items = [],
  history,
  member = {},
}: Options = {}) {
  const alex = createMember({ id: ALEX, schedule: WEEKLY, history, ...member });
  return renderWithProviders(
    <>
      <PrepPrompts memberId={ALEX} />
      <button type="button">Next control</button>
    </>,
    {
      initialData: { members: [alex] },
      initialPrivateData: {
        notes:
          lastMetDaysAgo === null
            ? []
            : [
                createNote({
                  memberId: ALEX,
                  content: lastNote,
                  createdAt: daysAgo(lastMetDaysAgo),
                }),
              ],
        actionItems: items.map((title) => createActionItem({ memberId: ALEX, title })),
      },
    },
  );
}

const reduceMotion = () =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

const prepRegion = () => screen.getByRole('region', { name: 'PREP' });

describe('PrepPrompts', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('renders the PREP heading inside a section labelled by it', () => {
    renderPrep();

    const section = screen.getByRole('region', { name: 'PREP' });
    expect(within(section).getByRole('heading', { level: 3, name: 'PREP' })).toBeInTheDocument();
  });

  it('shows the number of days since the last 1:1', () => {
    renderPrep({ lastMetDaysAgo: 9 });

    expect(screen.getByText('9 days')).toBeInTheDocument();
    expect(screen.getByText('9 days').closest('p')).toHaveTextContent('9 days since last 1:1');
    expect(within(prepRegion()).queryByRole('status')).not.toBeInTheDocument();
  });

  it('says so when the last 1:1 was today', () => {
    renderPrep({ lastMetDaysAgo: 0 });

    expect(screen.getByText('Last 1:1 was today')).toBeInTheDocument();
  });

  it('uses the singular for one day', () => {
    renderPrep({ lastMetDaysAgo: 1 });

    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('warns once the gap is more than 1.5 times the cadence', () => {
    renderPrep({ lastMetDaysAgo: 11 });

    expect(screen.getByText('11 days').closest('p')).toHaveClass('prep-card__days--warning');
  });

  it('does not warn at exactly 1.5 times the cadence', () => {
    renderPrep({ lastMetDaysAgo: 10 });

    expect(screen.getByText('10 days').closest('p')).not.toHaveClass('prep-card__days--warning');
  });

  it('announces the warning to screen readers with a status message', () => {
    renderPrep({ lastMetDaysAgo: 21 });

    expect(within(prepRegion()).getByRole('status')).toHaveTextContent(
      'Warning: 21 days since last 1:1, exceeds usual cadence',
    );
  });

  it('never warns when the person has no 1:1 schedule', () => {
    renderPrep({ lastMetDaysAgo: 90, member: { schedule: undefined } });

    expect(screen.getByText('90 days')).toBeInTheDocument();
    expect(within(prepRegion()).queryByRole('status')).not.toBeInTheDocument();
  });

  it('lists the open action items', () => {
    renderPrep({ items: ['Send the launch plan', 'Review the offer'] });

    const list = screen.getByRole('list', { name: '' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Send the launch plan', 'Review the offer']);
  });

  it('leaves out action items that are done', () => {
    renderWithProviders(<PrepPrompts memberId={ALEX} />, {
      initialData: { members: [createMember({ id: ALEX })] },
      initialPrivateData: {
        notes: [createNote({ memberId: ALEX })],
        actionItems: [
          createActionItem({ memberId: ALEX, title: 'Shipped already', status: 'done' }),
        ],
      },
    });

    expect(screen.queryByText('Shipped already')).not.toBeInTheDocument();
    expect(screen.getByText('None open')).toBeInTheDocument();
  });

  it('shows at most five action items and a "+N more" button for the rest', async () => {
    const user = userEvent.setup();
    renderPrep({ items: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'] });

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByText('Six')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+2 more' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('does not offer "+N more" for exactly five items', () => {
    renderPrep({ items: ['One', 'Two', 'Three', 'Four', 'Five'] });

    expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument();
  });

  it('shows what was discussed last time', () => {
    renderPrep({ lastNote: 'Talked about the launch plan' });

    expect(screen.getByText('Last time you discussed:')).toBeInTheDocument();
    expect(screen.getByText('Talked about the launch plan')).toBeInTheDocument();
  });

  it('cuts a long last note to 100 characters at a word boundary', () => {
    const note = `${'word '.repeat(40)}end`;
    renderPrep({ lastNote: note });

    const summary = screen.getByText(/^word word/);
    expect(summary.textContent).toMatch(/word…$/);
    expect(summary.textContent!.length).toBeLessThanOrEqual(100);
  });

  it('leaves out the last-discussed section when the last session had no notes', () => {
    renderPrep({ lastNote: '(No notes)' });

    expect(screen.queryByText('Last time you discussed:')).not.toBeInTheDocument();
  });

  it('shows status changes made since the last 1:1 with the new status', () => {
    renderPrep({
      lastMetDaysAgo: 10,
      history: [
        { id: 'old', date: daysAgo(20), field: 'status', from: 'active', to: 'departing' },
        { id: 'new', date: daysAgo(3), field: 'status', from: 'active', to: 'on_leave' },
        { id: 'role', date: daysAgo(2), field: 'role', to: 'Staff Engineer' },
      ],
    });

    expect(screen.getByText('On leave')).toBeInTheDocument();
    expect(screen.getByText('3 days ago')).toBeInTheDocument();
    expect(screen.queryByText('Departing')).not.toBeInTheDocument();
  });

  it('shows no status line when nothing changed', () => {
    renderPrep();

    expect(screen.queryByText(/Changed to/)).not.toBeInTheDocument();
  });

  it('shows a placeholder for reminders', () => {
    renderPrep();

    expect(screen.getByText('No reminders')).toBeInTheDocument();
  });

  it('starts expanded, with the toggle controlling the content', () => {
    renderPrep();

    const toggle = screen.getByRole('button', { name: 'Collapse prep' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'prep-content');
    expect(document.getElementById('prep-content')).not.toHaveAttribute('aria-hidden');
  });

  it('collapses the content and hides it from assistive technology', async () => {
    const user = userEvent.setup();
    renderPrep();

    await user.click(screen.getByRole('button', { name: 'Collapse prep' }));

    expect(screen.getByRole('button', { name: 'Expand prep' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(document.getElementById('prep-content')).toHaveAttribute('aria-hidden', 'true');
    expect(document.getElementById('prep-content')).toHaveAttribute('inert');
  });

  it('expands again when the toggle is clicked a second time', async () => {
    const user = userEvent.setup();
    renderPrep();

    await user.click(screen.getByRole('button', { name: 'Collapse prep' }));
    await user.click(screen.getByRole('button', { name: 'Expand prep' }));

    expect(screen.getByRole('button', { name: 'Collapse prep' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(document.getElementById('prep-content')).not.toHaveAttribute('aria-hidden');
  });

  it('removes the whole card when dismissed', async () => {
    reduceMotion();
    const user = userEvent.setup();
    renderPrep({ items: ['Send the launch plan'] });

    await user.click(screen.getByRole('button', { name: 'Dismiss prep prompts' }));

    expect(screen.queryByRole('region', { name: 'PREP' })).not.toBeInTheDocument();
    expect(screen.queryByText('Send the launch plan')).not.toBeInTheDocument();
  });

  it('fades the card out before removing it when motion is allowed', async () => {
    const user = userEvent.setup();
    renderPrep();

    await user.click(screen.getByRole('button', { name: 'Dismiss prep prompts' }));

    expect(screen.getByRole('region', { name: 'PREP' })).toHaveClass('prep-card--dismissing');
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'PREP' })).not.toBeInTheDocument(),
    );
  });

  it('moves focus to the next control when dismissed', async () => {
    reduceMotion();
    const user = userEvent.setup();
    renderPrep();

    await user.click(screen.getByRole('button', { name: 'Dismiss prep prompts' }));

    expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus();
  });

  it('remembers the dismissal for the session as a bare flag', async () => {
    reduceMotion();
    const user = userEvent.setup();
    const { unmount } = renderPrep();

    await user.click(screen.getByRole('button', { name: 'Dismiss prep prompts' }));

    expect(isPrepDismissed()).toBe(true);
    expect(Object.fromEntries(Object.entries(window.sessionStorage))).toEqual({
      'crewbook:prep-dismissed': 'true',
    });

    unmount();
    renderPrep();
    expect(screen.queryByRole('region', { name: 'PREP' })).not.toBeInTheDocument();
  });

  it('comes back in a new session', async () => {
    reduceMotion();
    const user = userEvent.setup();
    const { unmount } = renderPrep();
    await user.click(screen.getByRole('button', { name: 'Dismiss prep prompts' }));
    unmount();

    window.sessionStorage.clear();
    renderPrep();

    expect(screen.getByRole('region', { name: 'PREP' })).toBeInTheDocument();
  });

  it('renders nothing when there is no earlier 1:1', () => {
    renderPrep({ lastMetDaysAgo: null, items: ['Orphan item'] });

    expect(screen.queryByRole('region', { name: 'PREP' })).not.toBeInTheDocument();
    expect(screen.queryByText('Orphan item')).not.toBeInTheDocument();
  });

  it('renders nothing for a person who does not exist', () => {
    renderWithProviders(<PrepPrompts memberId={ALEX} />, {
      initialPrivateData: { notes: [createNote({ memberId: ALEX })] },
    });

    expect(screen.queryByRole('region', { name: 'PREP' })).not.toBeInTheDocument();
  });

  it('puts no title attributes on note or action item text', () => {
    const { container } = renderPrep({ items: ['Send the launch plan'] });

    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('has no accessibility violations, expanded or in the warning state', async () => {
    const { container } = renderPrep({ lastMetDaysAgo: 21, items: ['Send the launch plan'] });

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when collapsed', async () => {
    const user = userEvent.setup();
    const { container } = renderPrep({ items: ['Send the launch plan'] });

    await user.click(screen.getByRole('button', { name: 'Collapse prep' }));

    expect(await axe(container)).toHaveNoViolations();
  });
});

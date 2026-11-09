import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createFeedback, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { toIsoDate } from '../utils/scheduleCalculator';
import { FeedbackLog } from './FeedbackLog';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

const seeded = () => [
  createFeedback({
    engineerId: ALEX.id,
    date: '2025-03-10',
    type: 'positive',
    text: 'Ran the launch review calmly',
    tags: ['leadership'],
  }),
  createFeedback({
    engineerId: PRIYA.id,
    date: '2025-02-01',
    type: 'constructive',
    text: 'Talked over teammates in planning',
    tags: ['communication'],
  }),
  createFeedback({
    engineerId: ALEX.id,
    date: '2025-04-02',
    type: 'neutral',
    text: 'Asked about the roadmap',
    tags: [],
  }),
];

function renderLog(
  props: Partial<React.ComponentProps<typeof FeedbackLog>> = {},
  feedback = seeded(),
) {
  return renderWithProviders(<FeedbackLog {...props} />, {
    initialData: { members: [ALEX, PRIYA] },
    initialPrivateData: { feedback },
  });
}

const list = () => screen.getByRole('list', { name: 'Feedback entries' });
const texts = () => within(list()).getAllByText(/./, { selector: '.feedback-card__text' });

describe('FeedbackLog', () => {
  it('lists entries newest first with person, type and tags', () => {
    renderLog();

    expect(texts().map((node) => node.textContent)).toEqual([
      'Asked about the roadmap',
      'Ran the launch review calmly',
      'Talked over teammates in planning',
    ]);
    expect(within(list()).getByText('leadership')).toBeInTheDocument();
    expect(screen.getByText('For your eyes only')).toBeInTheDocument();
  });

  it('says how many entries are shown, politely', () => {
    renderLog();

    expect(screen.getByText('3 feedback entries shown')).toHaveAttribute('role', 'status');
  });

  it('states that feedback is private', () => {
    renderLog();

    expect(screen.getByText(/Only you can see feedback/)).toBeInTheDocument();
  });

  it('invites the first observation when empty and opens the form', async () => {
    const user = userEvent.setup();
    renderLog({}, []);

    expect(screen.getByText('No feedback logged yet')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter feedback' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Log your first observation' }));

    expect(screen.getByRole('dialog', { name: 'Log feedback' })).toBeInTheDocument();
  });

  it('filters by person, type and tag, and says when nothing matches', async () => {
    const user = userEvent.setup();
    renderLog();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Person' }), ALEX.id);
    expect(texts()).toHaveLength(2);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'positive');
    expect(texts().map((node) => node.textContent)).toEqual(['Ran the launch review calmly']);
    expect(screen.getByText('1 feedback entry shown')).toHaveAttribute('role', 'status');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Person' }), PRIYA.id);
    expect(screen.getByText('No matching feedback')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(texts()).toHaveLength(3);
  });

  it('filters by date range, inclusive of both ends', () => {
    renderLog();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-02-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2025-03-10' } });

    expect(texts().map((node) => node.textContent)).toEqual([
      'Ran the launch review calmly',
      'Talked over teammates in planning',
    ]);
  });

  it('searches the text after a short pause', async () => {
    const user = userEvent.setup();
    renderLog();

    await user.type(screen.getByRole('searchbox', { name: 'Search feedback' }), 'roadmap');
    expect(texts()).toHaveLength(3);

    await waitFor(() =>
      expect(texts().map((node) => node.textContent)).toEqual(['Asked about the roadmap']),
    );
  });

  it('limits itself to one person and hides the person filter', () => {
    renderLog({ engineerId: PRIYA.id });

    expect(texts().map((node) => node.textContent)).toEqual(['Talked over teammates in planning']);
    expect(screen.queryByRole('combobox', { name: 'Person' })).toBeNull();
  });

  it('opens the form for that person when logging from their profile', async () => {
    const user = userEvent.setup();
    renderLog({ engineerId: PRIYA.id });

    await user.click(screen.getByRole('button', { name: 'Log feedback' }));

    expect(screen.getByRole('combobox', { name: /Person/ })).toHaveValue(PRIYA.id);
  });

  it('logs a new entry from the form and shows it', async () => {
    const user = userEvent.setup();
    renderLog({ engineerId: ALEX.id });

    await user.click(screen.getByRole('button', { name: 'Log feedback' }));
    await user.click(screen.getByRole('radio', { name: 'Positive' }));
    await user.type(
      screen.getByRole('textbox', { name: /What did you observe/ }),
      'Mentored the new hire',
    );
    await user.click(screen.getByRole('button', { name: 'Save feedback' }));

    expect(await screen.findByText('Mentored the new hire')).toBeInTheDocument();
    expect(screen.getByText('Feedback logged')).toBeInTheDocument();
    expect(texts()[0]).toHaveTextContent('Mentored the new hire');
  });

  it('edits an entry in place', async () => {
    const user = userEvent.setup();
    renderLog();

    await user.click(
      screen.getByRole('button', {
        name: 'Edit neutral feedback for Alex Chen from April 2, 2025',
      }),
    );
    const field = screen.getByRole('textbox', { name: /What did you observe/ });
    await user.clear(field);
    await user.type(field, 'Asked about the Q3 roadmap');
    await user.click(screen.getByRole('button', { name: 'Save feedback' }));

    expect(await screen.findByText('Asked about the Q3 roadmap')).toBeInTheDocument();
    expect(screen.queryByText('Asked about the roadmap')).toBeNull();
    expect(texts()).toHaveLength(3);
  });

  it('asks before deleting, and keeps the entry on cancel', async () => {
    const user = userEvent.setup();
    renderLog();
    const trigger = () =>
      screen.getByRole('button', {
        name: 'Delete neutral feedback for Alex Chen from April 2, 2025',
      });

    await user.click(trigger());
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(texts()).toHaveLength(3);
  });

  it('deletes after confirming and moves focus to the heading', async () => {
    const user = userEvent.setup();
    renderLog();

    await user.click(
      screen.getByRole('button', {
        name: 'Delete neutral feedback for Alex Chen from April 2, 2025',
      }),
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(texts()).toHaveLength(2));
    expect(screen.getByText('Feedback deleted')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Feedback' })).toHaveFocus());
  });

  it('shows text as plain text, never markup', () => {
    renderLog({}, [
      createFeedback({
        engineerId: ALEX.id,
        text: '<img src=x onerror=alert(1)> **bold**',
        tags: [],
      }),
    ]);

    expect(screen.getByText('<img src=x onerror=alert(1)> **bold**')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('shows a removed person’s entries under a neutral name', () => {
    renderLog({}, [createFeedback({ engineerId: 'gone', text: 'Old note', tags: [] })]);

    expect(screen.getByText('Former team member')).toBeInTheDocument();
  });

  it('focuses the heading on mount when it is the page', () => {
    renderLog({ headingLevel: 1, focusHeadingOnMount: true });

    expect(screen.getByRole('heading', { level: 1, name: 'Feedback' })).toHaveFocus();
  });

  describe('promo packet mode', () => {
    const openPromo = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: 'Promo packet mode' }));
      return screen.getByRole('region', { name: 'Promo packet mode' });
    };

    it('toggles from a button that reports its state', async () => {
      const user = userEvent.setup();
      renderLog();
      const toggle = screen.getByRole('button', { name: 'Promo packet mode' });
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(
        screen.getByText('Choose a person and a date range to build the packet.'),
      ).toBeVisible();
    });

    it('builds positive feedback only, oldest first, for the chosen person and dates', async () => {
      const user = userEvent.setup();
      renderLog({}, [
        ...seeded(),
        createFeedback({
          engineerId: ALEX.id,
          date: '2025-03-01',
          type: 'positive',
          text: 'Earlier win',
          tags: [],
        }),
      ]);
      const panel = await openPromo(user);

      await user.selectOptions(within(panel).getByRole('combobox', { name: 'Person' }), ALEX.id);
      fireEvent.change(within(panel).getByLabelText('From'), { target: { value: '2025-01-01' } });
      fireEvent.change(within(panel).getByLabelText('To'), {
        target: { value: toIsoDate(new Date()) },
      });

      const output = within(panel).getByRole('region', { name: 'Promo packet text' });
      expect(output).toHaveTextContent('Promo packet: Alex Chen');
      expect(output.textContent).toContain('Earlier win');
      expect(output.textContent).toContain('Ran the launch review calmly');
      expect(output.textContent!.indexOf('Earlier win')).toBeLessThan(
        output.textContent!.indexOf('Ran the launch review'),
      );
      expect(output.textContent).not.toContain('Asked about the roadmap');
      expect(output.textContent).not.toContain('Talked over');
    });

    it('locks the person on a profile', async () => {
      const user = userEvent.setup();
      renderLog({ engineerId: ALEX.id });
      const panel = await openPromo(user);

      expect(within(panel).queryByRole('combobox', { name: 'Person' })).toBeNull();
      expect(within(panel).getByText('Positive only')).toBeInTheDocument();
      expect(within(panel).getByText(/Choose a date range/)).toBeInTheDocument();
    });

    it('copies the packet and confirms without echoing it', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      renderLog({ engineerId: ALEX.id });
      const panel = await openPromo(user);
      fireEvent.change(within(panel).getByLabelText('From'), { target: { value: '2025-01-01' } });
      fireEvent.change(within(panel).getByLabelText('To'), {
        target: { value: toIsoDate(new Date()) },
      });

      await user.click(
        within(panel).getByRole('button', { name: 'Copy promo packet to clipboard' }),
      );

      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      expect(String(writeText.mock.calls[0][0])).toContain('Ran the launch review calmly');
      expect((await screen.findAllByText('Copied to clipboard')).length).toBeGreaterThan(0);
      expect(
        screen.queryByText(/launch review/, { selector: '[role="status"], [role="alert"]' }),
      ).toBeNull();
    });

    it('says so when the copy fails', async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
      renderLog({ engineerId: ALEX.id });
      const panel = await openPromo(user);
      fireEvent.change(within(panel).getByLabelText('From'), { target: { value: '2025-01-01' } });
      fireEvent.change(within(panel).getByLabelText('To'), {
        target: { value: toIsoDate(new Date()) },
      });

      await user.click(
        within(panel).getByRole('button', { name: 'Copy promo packet to clipboard' }),
      );

      expect(await screen.findByText('Copy failed. Try again.')).toBeInTheDocument();
    });

    it('says when the period has no positive feedback', async () => {
      const user = userEvent.setup();
      renderLog({ engineerId: PRIYA.id });
      const panel = await openPromo(user);
      fireEvent.change(within(panel).getByLabelText('From'), { target: { value: '2025-01-01' } });
      fireEvent.change(within(panel).getByLabelText('To'), {
        target: { value: toIsoDate(new Date()) },
      });

      expect(within(panel).getByRole('region', { name: 'Promo packet text' })).toHaveTextContent(
        'No positive feedback in this period.',
      );
    });
  });

  it('has no accessibility violations, with the list, the form and promo mode', async () => {
    const user = userEvent.setup();
    const { container } = renderLog();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Promo packet mode' }));
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Log feedback' }));
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

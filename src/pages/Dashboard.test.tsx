import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import {
  createActionItem,
  createLeave,
  createMember,
  createNote,
  createReminder,
  createTodo,
} from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { Schedule } from '../types/Schedule';
import { Dashboard } from './Dashboard';

// Monday 15 June 2026, midday.
const NOW = new Date(2026, 5, 15, 12);
const TODAY = '2026-06-15';
const COLLAPSE_KEY = 'dashboard-collapse-state';

const schedule = (nextDate: string, time = '10:00'): Schedule => ({
  cadence: 'weekly',
  dayOfWeek: 'monday',
  time,
  nextDate,
});

const ALEX = createMember({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alex Chen',
  schedule: schedule(TODAY, '14:30'),
});
const PRIYA = createMember({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Priya Nair',
  schedule: schedule('2026-06-18'),
});

const renderDashboard = (data: Parameters<typeof renderWithProviders>[1] = {}, now: Date = NOW) =>
  renderWithProviders(
    <Routes>
      <Route path="/" element={<Dashboard now={now} />} />
      <Route path="/person/:id" element={<p>Profile page</p>} />
      <Route path="/tasks" element={<p>Tasks page</p>} />
    </Routes>,
    data,
  );

describe('Dashboard', () => {
  describe('header', () => {
    it.each([
      [new Date(2026, 5, 15, 9), 'Good morning'],
      [new Date(2026, 5, 15, 14), 'Good afternoon'],
      [new Date(2026, 5, 15, 19), 'Good evening'],
    ])('greets by time of day at %s', async (now, greeting) => {
      renderDashboard({}, now);

      expect(await screen.findByRole('heading', { level: 1, name: greeting })).toBeInTheDocument();
    });

    it('shows today as a machine-readable date', async () => {
      renderDashboard();

      const date = await screen.findByText('Monday, June 15, 2026');
      expect(date).toHaveAttribute('datetime', TODAY);
    });

    it('is a named region without nesting a second main landmark', async () => {
      renderDashboard();

      expect(await screen.findByRole('region', { name: 'Daily briefing' })).toBeInTheDocument();
      expect(screen.queryByRole('main')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('says all is clear and names the next 1:1', async () => {
      renderDashboard({ initialData: { members: [PRIYA] } });

      const message = await screen.findByText(/^All clear today\./);
      expect(message).toHaveTextContent(
        'All clear today. Your next 1:1 is with Priya Nair on Thursday.',
      );
      expect(message.closest('[role="status"]')).not.toBeNull();
      expect(screen.queryByRole('region', { name: "Today's 1:1s" })).not.toBeInTheDocument();
    });

    it('drops the next 1:1 when nobody is scheduled', async () => {
      renderDashboard({ initialData: { members: [createMember()] } });

      expect(await screen.findByText(/^All clear today\./)).toHaveTextContent(
        /^All clear today\.$/,
      );
    });
  });

  describe('sections', () => {
    it('puts the heading hierarchy in order: h1, a hidden h2, then an h3 per section', async () => {
      renderDashboard({ initialData: { members: [ALEX] } });

      await screen.findByRole('region', { name: "Today's 1:1s" });
      const tags = screen.getAllByRole('heading').map((heading) => heading.tagName);
      expect(tags[0]).toBe('H1');
      expect(tags[1]).toBe('H2');
      expect(tags.slice(2).every((tag) => tag === 'H3')).toBe(true);
    });

    it("lists today's 1:1s with open action items and opens the profile on click", async () => {
      const user = userEvent.setup();
      renderDashboard({
        initialData: { members: [ALEX] },
        initialPrivateData: {
          actionItems: [createActionItem({ memberId: ALEX.id })],
          notes: [
            createNote({ memberId: ALEX.id, createdAt: new Date(2026, 5, 1, 9).toISOString() }),
          ],
        },
      });

      const section = await screen.findByRole('region', { name: "Today's 1:1s" });
      const row = within(section).getByRole('link', { name: '1:1 with Alex Chen at 2:30 PM' });
      expect(within(row).getByLabelText('1 open action item')).toBeInTheDocument();
      expect(within(row).getByText('Jun 1, 2026')).toBeInTheDocument();
      await user.click(row);

      expect(screen.getByText('Profile page')).toBeInTheDocument();
    });

    it('shows people overdue for a 1:1', async () => {
      const lastMet = new Date();
      lastMet.setDate(lastMet.getDate() - 20);
      const member = createMember({ name: 'Sam Ortiz', schedule: schedule('2030-01-07') });

      renderDashboard({
        initialData: { members: [member] },
        initialPrivateData: {
          notes: [createNote({ memberId: member.id, createdAt: lastMet.toISOString() })],
        },
      });

      expect(await screen.findByRole('region', { name: 'Overdue 1:1s' })).toHaveTextContent(
        'Last met 20 days ago',
      );
    });

    it('lists only tasks due today, highest priority first, and links to the task list', async () => {
      const user = userEvent.setup();
      renderDashboard({
        initialPrivateData: {
          todos: [
            createTodo({ title: 'Low one', priority: 'low', dueDate: TODAY }),
            createTodo({ title: 'Urgent one', priority: 'high', dueDate: TODAY }),
            createTodo({ title: 'Tomorrow', dueDate: '2026-06-16' }),
            createTodo({ title: 'No date' }),
          ],
        },
      });

      const section = await screen.findByRole('region', { name: 'Action Items' });
      const links = within(section).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([
        expect.stringContaining('Urgent one'),
        expect.stringContaining('Low one'),
      ]);
      expect(screen.queryByText('Tomorrow')).not.toBeInTheDocument();
      await user.click(links[0]!);

      expect(screen.getByText('Tasks page')).toBeInTheDocument();
    });

    it('ticks off a task and keeps it listed, struck through', async () => {
      const user = userEvent.setup();
      renderDashboard({
        initialPrivateData: { todos: [createTodo({ title: 'Send feedback', dueDate: TODAY })] },
      });

      const box = await screen.findByRole('checkbox', { name: 'Send feedback' });
      expect(box).not.toBeChecked();
      await user.click(box);

      await waitFor(() =>
        expect(screen.getByRole('checkbox', { name: 'Send feedback' })).toBeChecked(),
      );
      expect(screen.getByRole('region', { name: 'Action Items' })).toBeInTheDocument();
    });

    it('shows reminders that are due and lets them be dismissed', async () => {
      const user = userEvent.setup();
      renderDashboard({
        initialData: { members: [ALEX] },
        initialPrivateData: {
          reminders: [
            createReminder({
              text: 'Congratulate on the launch',
              linkedPersonId: ALEX.id,
              triggerType: 'specific_date',
              triggerDate: TODAY,
            }),
          ],
        },
      });

      const section = await screen.findByRole('region', { name: 'Reminders' });
      expect(within(section).getByRole('status')).toHaveTextContent('Congratulate on the launch');
      await user.click(within(section).getByRole('button', { name: /^Dismiss reminder/ }));

      await waitFor(() =>
        expect(screen.queryByText('Congratulate on the launch')).not.toBeInTheDocument(),
      );
    });

    it('does not show reminders that are not due, dismissed or waiting for a 1:1', async () => {
      renderDashboard({
        initialData: { members: [ALEX] },
        initialPrivateData: {
          reminders: [
            createReminder({
              linkedPersonId: ALEX.id,
              triggerType: 'specific_date',
              triggerDate: '2099-01-01',
            }),
            createReminder({
              linkedPersonId: ALEX.id,
              triggerType: 'specific_date',
              triggerDate: TODAY,
              status: 'dismissed',
            }),
            createReminder({ linkedPersonId: ALEX.id }),
          ],
        },
      });

      await screen.findByRole('region', { name: "Today's 1:1s" });
      expect(
        within(screen.getByRole('region', { name: 'Reminders' })).getByText('No reminders today'),
      ).toBeInTheDocument();
    });

    it('lists people on leave with a generic label', async () => {
      const member = createMember({ name: 'Kai Mori', status: 'on_leave' });
      renderDashboard({ initialData: { members: [member] } });

      const section = await screen.findByRole('region', { name: 'On Leave' });
      const row = within(section).getByRole('link', { name: 'Kai Mori, Away' });
      expect(row).toHaveAttribute('href', `/person/${member.id}`);
      expect(section.innerHTML).not.toMatch(/data-leave/);
    });

    it('labels people on leave today with their leave type from the calendar', async () => {
      const kai = createMember({ name: 'Kai Mori', status: 'on_leave' });
      renderDashboard({
        initialData: { members: [ALEX, PRIYA, kai] },
        initialPrivateData: {
          leave: [
            createLeave({
              memberId: kai.id,
              type: 'parental',
              startDate: TODAY,
              endDate: '2026-06-30',
            }),
            createLeave({
              memberId: PRIYA.id,
              type: 'sick',
              startDate: '2026-06-14',
              endDate: TODAY,
            }),
            createLeave({
              memberId: ALEX.id,
              type: 'pto',
              startDate: '2026-06-16',
              endDate: '2026-06-16',
            }),
          ],
        },
      });

      const section = await screen.findByRole('region', { name: 'On Leave' });
      expect(within(section).getByRole('link', { name: 'Kai Mori, Parental' })).toBeInTheDocument();
      expect(within(section).getByRole('link', { name: 'Priya Nair, Sick' })).toBeInTheDocument();
      expect(within(section).queryByText('Alex Chen')).not.toBeInTheDocument();
      expect(within(section).queryByText('Away')).not.toBeInTheDocument();
    });

    it("lists this week's leave with dates and a type badge", async () => {
      renderDashboard({
        initialData: { members: [ALEX, PRIYA] },
        initialPrivateData: {
          leave: [
            createLeave({
              memberId: PRIYA.id,
              type: 'sick',
              startDate: '2026-06-17',
              endDate: '2026-06-18',
            }),
            createLeave({
              memberId: ALEX.id,
              type: 'pto',
              startDate: '2026-06-08',
              endDate: '2026-06-15',
            }),
            createLeave({
              memberId: ALEX.id,
              type: 'pto',
              startDate: '2026-06-22',
              endDate: '2026-06-23',
            }),
          ],
        },
      });

      const section = await screen.findByRole('region', { name: "Who's Out This Week" });
      const rows = within(section).getAllByRole('link');
      expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
        'Alex Chen, PTO, Jun 8 to Jun 15',
        'Priya Nair, Sick, Jun 17 to Jun 18',
      ]);
      expect(within(rows[1]).getByText('Sick')).toHaveAttribute('data-leave-type', 'sick');
      expect(await axe(section)).toHaveNoViolations();
    });

    it('says nobody is out when the week has no leave', async () => {
      renderDashboard({
        initialData: { members: [ALEX] },
        initialPrivateData: {
          leave: [
            createLeave({ memberId: ALEX.id, startDate: '2026-06-22', endDate: '2026-06-22' }),
          ],
        },
      });

      const section = await screen.findByRole('region', { name: "Who's Out This Week" });
      expect(within(section).getByText('Nobody is out this week')).toBeInTheDocument();
    });

    it('shows a count for each section that is present', async () => {
      renderDashboard({
        initialData: { members: [ALEX] },
        initialPrivateData: {
          todos: [createTodo({ dueDate: TODAY }), createTodo({ dueDate: TODAY })],
        },
      });

      const section = await screen.findByRole('region', { name: 'Action Items' });
      expect(within(section).getByRole('img', { name: '2 items' })).toBeInTheDocument();
      expect(
        within(screen.getByRole('region', { name: "Today's 1:1s" })).getByRole('img', {
          name: '1 item',
        }),
      ).toBeInTheDocument();
    });
  });

  describe('collapsing', () => {
    it('folds a section away and remembers it in local storage by id only', async () => {
      const user = userEvent.setup();
      renderDashboard({ initialData: { members: [ALEX] } });

      const toggle = await screen.findByRole('button', { name: "Toggle Today's 1:1s" });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('link', { name: /Alex Chen/ })).not.toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem(COLLAPSE_KEY) ?? '')).toEqual({
        'todays-one-ones': true,
      });
    });

    it('starts a section collapsed when it was left that way', async () => {
      window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ 'todays-one-ones': true }));
      renderDashboard({ initialData: { members: [ALEX] } });

      const toggle = await screen.findByRole('button', { name: "Toggle Today's 1:1s" });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: 'Toggle Overdue 1:1s' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
  });

  it('has no accessibility violations with sections, or in the empty state', async () => {
    const { container, unmount } = renderDashboard({
      initialData: { members: [ALEX, createMember({ name: 'Kai Mori', status: 'on_leave' })] },
      initialPrivateData: { todos: [createTodo({ dueDate: TODAY })] },
    });
    await screen.findByRole('region', { name: 'Action Items' });
    expect(await axe(container)).toHaveNoViolations();
    unmount();

    const empty = renderDashboard();
    await screen.findByText(/^All clear today\./);
    expect(await axe(empty.container)).toHaveNoViolations();
  });
});

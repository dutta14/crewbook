import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createLeave, createMember } from '../test-utils/factories';
import type { LeaveEntry } from '../types/leave';
import { CalendarGrid } from './CalendarGrid';
import type { CalendarView } from './CalendarToolbar';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const KAI = createMember({ id: 'kai', name: 'Kai Mori' });
const SAM = createMember({ id: 'sam', name: 'Sam Ortiz' });
const MEMBERS = [ALEX, PRIYA, KAI, SAM];
// Monday 15 June 2026.
const TODAY = '2026-06-15';

function Harness({
  entries = [],
  initialView = 'month',
  onSelectEntry = () => undefined,
}: {
  entries?: LeaveEntry[];
  initialView?: CalendarView;
  onSelectEntry?: (entry: LeaveEntry) => void;
}) {
  const [view, setView] = useState<CalendarView>(initialView);
  const [cursor, setCursor] = useState(TODAY);
  return (
    <CalendarGrid
      view={view}
      onViewChange={setView}
      cursor={cursor}
      onCursorChange={setCursor}
      entries={entries}
      members={MEMBERS}
      today={TODAY}
      onSelectEntry={onSelectEntry}
    />
  );
}

const day = (name: string) => screen.getByRole('gridcell', { name });

describe('CalendarGrid', () => {
  it('shows the month Monday to Sunday with today marked', () => {
    render(<Harness />);

    expect(screen.getByRole('heading', { name: 'June 2026' })).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
    expect(within(day('Monday, June 15')).getByText('15')).toHaveAttribute('aria-current', 'date');
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
  });

  it('defaults to month and links a single tabpanel to the active tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const month = screen.getByRole('tab', { name: 'Month' });
    expect(month).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', month.id);

    await user.click(screen.getByRole('tab', { name: 'Week' }));

    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      screen.getByRole('tab', { name: 'Week' }).id,
    );
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Jun 15, 2026 to Jun 21, 2026' })).toBeVisible();
  });

  it('switches view with the arrow keys on the tabs', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole('tab', { name: 'Month' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Week' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves by month or by week and returns to today', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'May 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('heading', { name: 'June 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Week' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('heading', { name: 'Jun 22, 2026 to Jun 28, 2026' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByRole('heading', { name: 'Jun 15, 2026 to Jun 21, 2026' })).toBeVisible();
  });

  it('shows a chip on every day of a leave, labelled with person, type and dates', () => {
    const entry = createLeave({
      memberId: ALEX.id,
      type: 'sick',
      startDate: '2026-06-16',
      endDate: '2026-06-18',
    });
    render(<Harness entries={[entry]} />);

    const chips = screen.getAllByRole('button', {
      name: 'Alex Chen, Sick, Jun 16, 2026 to Jun 18, 2026',
    });
    expect(chips).toHaveLength(3);
    expect(chips[0]).toHaveAttribute('data-leave-type', 'sick');
  });

  it('ignores leave for people who are no longer on the team', () => {
    render(
      <Harness entries={[createLeave({ memberId: 'gone', startDate: TODAY, endDate: TODAY })]} />,
    );

    expect(screen.queryByRole('button', { name: /gone|PTO/ })).not.toBeInTheDocument();
  });

  it('calls onSelectEntry when a chip is clicked', async () => {
    const user = userEvent.setup();
    const onSelectEntry = vi.fn();
    const entry = createLeave({ memberId: PRIYA.id, startDate: TODAY, endDate: TODAY });
    render(<Harness entries={[entry]} onSelectEntry={onSelectEntry} />);

    await user.click(screen.getByRole('button', { name: /Priya Nair, PTO/ }));

    expect(onSelectEntry).toHaveBeenCalledWith(entry);
  });

  it('flags a day with two people out and announces the overlap', () => {
    const entries = [
      createLeave({ memberId: ALEX.id, startDate: TODAY, endDate: TODAY }),
      createLeave({ memberId: PRIYA.id, type: 'sick', startDate: TODAY, endDate: '2026-06-16' }),
    ];
    render(<Harness entries={entries} />);

    expect(
      screen.getByRole('img', { name: 'Overlap: 2 people out on Monday, June 15' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /on Tuesday, June 16/ })).not.toBeInTheDocument();
  });

  it('does not flag a day when one person has two entries', () => {
    const entries = [
      createLeave({ memberId: ALEX.id, startDate: TODAY, endDate: TODAY }),
      createLeave({ memberId: ALEX.id, type: 'personal', startDate: TODAY, endDate: TODAY }),
    ];
    render(<Harness entries={entries} />);

    expect(screen.queryByRole('img', { name: /Overlap/ })).not.toBeInTheDocument();
  });

  it('caps a month cell at three chips and expands the rest on request', async () => {
    const user = userEvent.setup();
    const entries = [ALEX, PRIYA, KAI, SAM].map((member) =>
      createLeave({ memberId: member.id, startDate: TODAY, endDate: TODAY }),
    );
    render(<Harness entries={entries} />);

    const cell = day('Monday, June 15');
    expect(within(cell).getAllByRole('button', { name: /, PTO,/ })).toHaveLength(3);
    const more = within(cell).getByRole('button', {
      name: '1 more leave entries, click to expand',
    });
    expect(more).toHaveTextContent('+1 more');

    await user.click(more);
    expect(within(cell).getAllByRole('button', { name: /, PTO,/ })).toHaveLength(4);
    await user.click(within(cell).getByRole('button', { name: 'Show fewer leave entries' }));
    expect(within(cell).getAllByRole('button', { name: /, PTO,/ })).toHaveLength(3);
  });

  it('shows every entry in the week view', async () => {
    const entries = [ALEX, PRIYA, KAI, SAM].map((member) =>
      createLeave({ memberId: member.id, startDate: TODAY, endDate: TODAY }),
    );
    render(<Harness entries={entries} initialView="week" />);

    expect(within(day('Monday, June 15')).getAllByRole('button', { name: /, PTO,/ })).toHaveLength(
      4,
    );
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  describe('keyboard', () => {
    it('keeps one day in the tab order and moves focus with the arrow keys', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const start = day('Monday, June 15');
      expect(screen.getAllByRole('gridcell').filter((cell) => cell.tabIndex === 0)).toEqual([
        start,
      ]);

      start.focus();
      await user.keyboard('{ArrowRight}');
      expect(day('Tuesday, June 16')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(day('Tuesday, June 23')).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowUp}');
      expect(day('Monday, June 15')).toHaveFocus();
    });

    it('jumps to week edges and across months', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      day('Monday, June 15').focus();
      await user.keyboard('{End}');
      expect(day('Sunday, June 21')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(day('Monday, June 15')).toHaveFocus();
      await user.keyboard('{PageDown}');
      expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
      expect(day('Wednesday, July 15')).toHaveFocus();
      await user.keyboard('{PageUp}');
      expect(day('Monday, June 15')).toHaveFocus();
    });

    it('opens the first entry of a day with Enter', async () => {
      const user = userEvent.setup();
      const onSelectEntry = vi.fn();
      const entry = createLeave({ memberId: ALEX.id, startDate: TODAY, endDate: TODAY });
      render(<Harness entries={[entry]} onSelectEntry={onSelectEntry} />);

      day('Monday, June 15').focus();
      await user.keyboard('{Enter}');

      expect(onSelectEntry).toHaveBeenCalledWith(entry);
    });

    it('does nothing on Enter or other keys for an empty day', async () => {
      const user = userEvent.setup();
      const onSelectEntry = vi.fn();
      render(<Harness onSelectEntry={onSelectEntry} />);

      day('Monday, June 15').focus();
      await user.keyboard('{Enter}a');

      expect(onSelectEntry).not.toHaveBeenCalled();
      expect(day('Monday, June 15')).toHaveFocus();
    });

    it('follows focus when a day is clicked', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(day('Wednesday, June 17'));

      expect(day('Wednesday, June 17')).toHaveAttribute('tabindex', '0');
    });
  });

  it('has no accessibility violations in month and week view', async () => {
    const user = userEvent.setup();
    const entries = [
      createLeave({ memberId: ALEX.id, startDate: TODAY, endDate: '2026-06-17' }),
      createLeave({ memberId: PRIYA.id, type: 'parental', startDate: TODAY, endDate: TODAY }),
    ];
    const { container } = render(<Harness entries={entries} />);

    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('tab', { name: 'Week' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

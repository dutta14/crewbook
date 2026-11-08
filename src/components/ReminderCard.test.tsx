import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember, createReminder } from '../test-utils/factories';
import { ReminderCard, type ReminderCardProps } from './ReminderCard';

// Monday 15 June 2026.
const NOW = new Date(2026, 5, 15, 12);
const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });

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

afterEach(() => vi.unstubAllGlobals());

const renderCard = (props: Partial<ReminderCardProps> = {}) => {
  const handlers = {
    onDismiss: vi.fn().mockResolvedValue(undefined),
    onSnooze: vi.fn().mockResolvedValue(undefined),
  };
  const reminder = props.reminder ?? createReminder({ linkedPersonId: 'alex' });
  const result = render(
    <>
      <ReminderCard reminder={reminder} person={ALEX} now={NOW} {...handlers} {...props} />
      <button type="button">Next control</button>
    </>,
  );
  return { ...result, ...handlers, reminder };
};

describe('ReminderCard', () => {
  it('shows the reminder text, when it will surface and who it is about', () => {
    renderCard({ reminder: createReminder({ text: 'Ask about the offsite' }) });

    expect(screen.getByText('Ask about the offsite')).toBeInTheDocument();
    expect(screen.getByText('Before next 1:1')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alex Chen' })).toBeInTheDocument();
  });

  it('shows the date for a date reminder and the end of a snooze', () => {
    const { rerender } = renderCard({
      reminder: createReminder({ triggerType: 'specific_date', triggerDate: '2026-06-15' }),
    });
    expect(screen.getByText('On Mon, Jun 15, 2026')).toBeInTheDocument();

    rerender(
      <ReminderCard
        reminder={createReminder({ status: 'snoozed', snoozedUntil: '2026-06-22' })}
        person={ALEX}
        now={NOW}
        onDismiss={vi.fn()}
        onSnooze={vi.fn()}
      />,
    );
    expect(screen.getByText('Snoozed until Mon, Jun 22, 2026')).toBeInTheDocument();
  });

  it('falls back to the stored name when the person has left the team', () => {
    renderCard({ person: undefined, reminder: createReminder({ linkedPersonName: 'Sam Lee' }) });

    expect(screen.getByRole('img', { name: 'Sam Lee' })).toBeInTheDocument();
  });

  it('names the dismiss button after the start of the reminder', () => {
    renderCard({
      reminder: createReminder({ text: 'Remind Alex about the quarterly planning doc review' }),
    });

    expect(
      screen.getByRole('button', { name: 'Dismiss reminder: Remind Alex about the quarterl…' }),
    ).toBeInTheDocument();
  });

  it('dismisses straight away when motion is reduced', async () => {
    reduceMotion();
    const user = userEvent.setup();
    const { onDismiss, reminder } = renderCard();

    await user.click(screen.getByRole('button', { name: /^Dismiss reminder/ }));

    expect(onDismiss).toHaveBeenCalledWith(reminder.id);
  });

  it('fades out first, and only saves the dismissal once the fade is over', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onDismiss } = renderCard();

    await user.click(screen.getByRole('button', { name: /^Dismiss reminder/ }));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Dismiss reminder/ })).toBeDisabled();
    await vi.advanceTimersByTimeAsync(250);
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('saves a pending dismissal when it leaves the page mid-fade', async () => {
    const user = userEvent.setup();
    const { onDismiss, unmount } = renderCard();

    await user.click(screen.getByRole('button', { name: /^Dismiss reminder/ }));
    unmount();

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('puts the card back when the dismissal cannot be saved', async () => {
    reduceMotion();
    const user = userEvent.setup();
    renderCard({ onDismiss: vi.fn().mockRejectedValue(new Error('write failed')) });

    await user.click(screen.getByRole('button', { name: /^Dismiss reminder/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Dismiss reminder/ })).toBeEnabled(),
    );
  });

  it('moves focus to the next control when the card is dismissed', async () => {
    reduceMotion();
    const user = userEvent.setup();
    const Harness = () => {
      const [gone, setGone] = useState(false);
      return (
        <>
          {gone ? null : (
            <ReminderCard
              reminder={createReminder()}
              person={ALEX}
              now={NOW}
              onDismiss={async () => setGone(true)}
              onSnooze={vi.fn()}
            />
          )}
          <button type="button">Next control</button>
        </>
      );
    };
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /^Dismiss reminder/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus());
  });

  it('opens a snooze menu with the three durations and passes the choice on', async () => {
    const user = userEvent.setup();
    const { onSnooze, reminder } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Snooze' }));
    const menu = screen.getByRole('menu', { name: 'Snooze for' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['1 day', '1 week', 'Next 1:1']);
    await user.click(within(menu).getByRole('menuitem', { name: '1 week' }));

    expect(onSnooze).toHaveBeenCalledWith(reminder.id, '1_week');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('navigates the snooze menu with the arrow keys and closes it on Escape', async () => {
    const user = userEvent.setup();
    renderCard();
    const trigger = screen.getByRole('button', { name: 'Snooze' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: '1 day' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: '1 week' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Next 1:1' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: '1 day' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Next 1:1' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: '1 day' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the snooze menu on a click elsewhere and on Tab', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Snooze' }));
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Snooze' }));
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers no actions on a past reminder', () => {
    renderCard({ isPast: true, reminder: createReminder({ status: 'dismissed' }) });

    expect(screen.queryByRole('button')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Dismiss reminder/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Snooze' })).not.toBeInTheDocument();
  });

  it('announces itself as a status when asked to', () => {
    renderCard({ announce: true });

    expect(screen.getByRole('status')).toHaveTextContent('Ask about the on-call rotation');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderCard();

    expect(await axe(container)).toHaveNoViolations();
  });
});

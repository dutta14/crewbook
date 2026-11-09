import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useSharedActionItems } from '../hooks/useSharedActionItems';
import type { SharedActionItem } from '../types/sharing';
import { SharedActionItems } from './SharedActionItems';

const AS_OF = '2026-01-10T09:00:00Z';

const make = (
  id: string,
  title: string,
  overrides: Partial<SharedActionItem> = {},
): SharedActionItem => ({ id, title, status: 'open', owner: 'engineer', ...overrides });

function Harness({
  snapshot,
  currentUserIsManager = false,
}: {
  snapshot: SharedActionItem[];
  currentUserIsManager?: boolean;
}) {
  const { items, toggle } = useSharedActionItems(snapshot);
  return (
    <SharedActionItems
      items={items}
      currentUserIsManager={currentUserIsManager}
      managerName="Morgan Lee"
      asOf={AS_OF}
      onToggle={toggle}
    />
  );
}

const renderItems = (snapshot: SharedActionItem[], currentUserIsManager = false) =>
  render(<Harness snapshot={snapshot} currentUserIsManager={currentUserIsManager} />);

const box = (title: string) => screen.getByRole('checkbox', { name: `Mark ${title} as done` });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SharedActionItems', () => {
  it('shows the title, owner and due date of each item', () => {
    renderItems([
      make('a1', 'Write the doc', { dueDate: '2999-03-04' }),
      make('a2', 'Book the room', { owner: 'manager' }),
    ]);

    const list = screen.getByRole('list', { name: 'Action items' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Write the doc')).toBeInTheDocument();
    expect(within(list).getByText(/^Due .*2999/)).toBeInTheDocument();
    expect(within(list).getByText('You')).toBeInTheDocument();
    expect(within(list).getByText('Morgan Lee')).toBeInTheDocument();
  });

  it('names the owner for screen readers without relying on position', () => {
    renderItems([make('a1', 'Write the doc')]);

    expect(screen.getByText('Owner:')).toHaveClass('sr-only');
  });

  it('labels the owner "You" for the manager’s own items when the reader is the manager', () => {
    renderItems(
      [make('a1', 'Mine', { owner: 'manager' }), make('a2', 'Theirs', { owner: 'engineer' })],
      true,
    );

    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('You')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Engineer')).toBeInTheDocument();
  });

  it('renders the due date in a time element carrying the ISO date', () => {
    renderItems([make('a1', 'Write the doc', { dueDate: '2999-03-04' })]);

    expect(screen.getByText(/^Due /).closest('time')).toHaveAttribute('datetime', '2999-03-04');
  });

  it('says overdue in text, not only in colour, for an open item past its due date', () => {
    renderItems([make('a1', 'Late', { dueDate: '2000-01-01' })]);

    expect(screen.getByText(/^Due /)).toHaveTextContent('(overdue)');
    expect(screen.getByText(/^Due /)).toHaveClass('shared-action__due--overdue');
  });

  it('does not flag an item with a future due date or no due date as overdue', () => {
    renderItems([make('a1', 'Soon', { dueDate: '2999-01-01' }), make('a2', 'Whenever')]);

    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Due /)).toHaveLength(1);
  });

  it('shows done items only inside a collapsed Done section with a count', () => {
    renderItems([make('a1', 'Open one'), make('a2', 'Finished', { status: 'done' })]);

    const toggle = screen.getByRole('button', { name: 'Done (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'done-items-list');
    expect(screen.queryByText('Finished')).not.toBeInTheDocument();
  });

  it('expands and collapses the Done section with the toggle', async () => {
    const user = userEvent.setup();
    renderItems([make('a1', 'Open one'), make('a2', 'Finished', { status: 'done' })]);

    const toggle = screen.getByRole('button', { name: 'Done (1)' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('list', { name: 'Done action items' }).closest('#done-items-list'),
    ).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-controls', 'done-items-list');
    expect(box('Finished')).toBeChecked();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Finished')).not.toBeInTheDocument();
  });

  it('opens and closes the Done section from the keyboard', async () => {
    const user = userEvent.setup();
    renderItems([make('a1', 'Finished', { status: 'done' })]);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Done (1)' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Done (1)' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Done (1)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('shows the open count in the heading of the open list', () => {
    renderItems([make('a1', 'One'), make('a2', 'Two'), make('a3', 'Three', { status: 'done' })]);

    expect(screen.getByRole('heading', { level: 3, name: 'Open (2)' })).toBeInTheDocument();
  });

  it('moves a ticked item into the Done count and strikes it through when shown', async () => {
    const user = userEvent.setup();
    renderItems([make('a1', 'One'), make('a2', 'Two')]);

    await user.click(box('One'));

    expect(screen.getByRole('heading', { level: 3, name: 'Open (1)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done (1)' }));
    expect(box('One')).toBeChecked();
    expect(screen.getByText('One')).toHaveClass('shared-action__title--done');
  });

  it('moves an unticked done item back to the open list and focuses it', async () => {
    const user = userEvent.setup();
    renderItems([make('a1', 'One'), make('a2', 'Finished', { status: 'done' })]);

    await user.click(screen.getByRole('button', { name: 'Done (1)' }));
    await user.click(box('Finished'));

    expect(screen.getByRole('heading', { level: 3, name: 'Open (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Done/ })).not.toBeInTheDocument();
    expect(box('Finished')).not.toBeChecked();
    expect(box('Finished')).toHaveFocus();
  });

  it('moves focus to the next open item after ticking one', async () => {
    const user = userEvent.setup();
    renderItems([make('a1', 'One'), make('a2', 'Two'), make('a3', 'Three')]);

    await user.click(box('One'));

    expect(box('Two')).toHaveFocus();
  });

  it('moves focus to the previous open item when the last one is ticked', async () => {
    const user = userEvent.setup();
    renderItems([make('a1', 'One'), make('a2', 'Two')]);

    await user.click(box('Two'));

    expect(box('One')).toHaveFocus();
  });

  it('moves focus to the section heading when the last open item is ticked', async () => {
    const user = userEvent.setup();
    renderItems([make('a1', 'Only')]);

    await user.click(box('Only'));

    expect(screen.getByRole('heading', { level: 2, name: 'Action items' })).toHaveFocus();
    expect(screen.getByText('No open action items')).toBeInTheDocument();
  });

  it('announces only how many items are done, never their titles', async () => {
    const user = userEvent.setup();
    renderItems([make('a1', 'Fire the vendor'), make('a2', 'Promote Sam')]);
    const status = screen.getByRole('status');

    await user.click(box('Fire the vendor'));
    expect(status).toHaveTextContent('1 item done');
    await user.click(box('Promote Sam'));
    expect(status).toHaveTextContent('2 items done');
    expect(status).not.toHaveTextContent(/vendor|Sam/);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('says the changes are for this session only, next to the list', () => {
    renderItems([make('a1', 'One')]);

    const note = screen.getByText(/saved for this session only/);
    expect(note).toHaveTextContent('Changes you make here are saved for this session only.');
    expect(note.closest('section')).toBe(screen.getByRole('region', { name: 'Action items' }));
  });

  it('keeps the ticks in memory only: nothing is stored or sent', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderItems([make('a1', 'One'), make('a2', 'Two')]);

    await user.click(box('One'));
    await user.click(box('Two'));

    expect(setItem).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('starts again from the link’s snapshot after a reload', async () => {
    const user = userEvent.setup();
    const snapshot = [make('a1', 'One')];
    const first = renderItems(snapshot);
    await user.click(box('One'));
    expect(screen.getByRole('button', { name: 'Done (1)' })).toBeInTheDocument();
    first.unmount();

    renderItems(snapshot);

    expect(box('One')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /^Done/ })).not.toBeInTheDocument();
  });

  it('offers no way to add, edit, delete or reassign an item', () => {
    renderItems([make('a1', 'One'), make('a2', 'Two', { status: 'done' })]);

    expect(screen.queryByRole('button', { name: /add|new|edit|delete|remove|assign/i })).toBeNull();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows plain text for a title that looks like markup', () => {
    renderItems([make('a1', '<img src=x onerror=alert(1)> **bold**')]);

    expect(screen.getByText('<img src=x onerror=alert(1)> **bold**')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows an empty state with no note, controls or list when there are no items', () => {
    renderItems([]);

    expect(screen.getByText('No action items yet')).toBeInTheDocument();
    expect(screen.queryByText(/session only/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says there is nothing open when every item is done, and still offers the Done section', () => {
    renderItems([make('a1', 'Finished', { status: 'done' })]);

    expect(screen.getByText('No open action items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done (1)' })).toBeInTheDocument();
  });

  it('has no accessibility violations, collapsed or expanded', async () => {
    const user = userEvent.setup();
    const { container } = renderItems([
      make('a1', 'Late', { dueDate: '2000-01-01' }),
      make('a2', 'Finished', { status: 'done', owner: 'manager' }),
    ]);

    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Done (1)' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('useSharedActionItems', () => {
  it('ignores a toggle for an id that did not come with the link', async () => {
    const user = userEvent.setup();
    function Probe() {
      const { items, toggle } = useSharedActionItems([make('a1', 'One')]);
      return (
        <>
          <button type="button" onClick={() => toggle('not-in-link', true)}>
            toggle unknown
          </button>
          <output>{items.map((item) => `${item.id}:${item.status}`).join(',')}</output>
        </>
      );
    }
    render(<Probe />);

    await user.click(screen.getByRole('button', { name: 'toggle unknown' }));

    expect(screen.getByRole('status')).toHaveTextContent('a1:open');
  });
});

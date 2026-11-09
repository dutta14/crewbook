import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { useAgendaItems, type UseAgendaItems } from './useAgendaItems';

function setup() {
  const ref: { current: UseAgendaItems | null } = { current: null };
  function Probe() {
    ref.current = useAgendaItems('alex');
    return null;
  }
  renderWithProviders(<Probe />, { initialPrivateData: { agendaItems: [] } });
  return () => {
    if (!ref.current) throw new Error('not rendered');
    return ref.current;
  };
}

describe('useAgendaItems', () => {
  it('adds, ticks, opts out of sharing and removes an item', async () => {
    const get = setup();

    await act(async () => {
      await get().addItem('Topic', 'manager');
    });
    expect(get().items).toHaveLength(1);
    const { id } = get().items[0]!;

    await act(async () => get().toggleDiscussed(id));
    expect(get().items[0]?.discussed).toBe(true);
    await act(async () => get().setIncludeInShare(id, false));
    expect(get().items[0]?.includeInShare).toBe(false);
    await act(async () => get().deleteItem(id));
    expect(get().items).toEqual([]);
  });

  it('rejects a validation error without a toast', async () => {
    const get = setup();

    await act(async () => {
      await get()
        .addItem('   ', 'manager')
        .catch(() => undefined);
    });

    expect(screen.queryByText(/Couldn't/)).not.toBeInTheDocument();
  });

  it('shows an error toast when a change fails', async () => {
    const get = setup();

    await act(async () => {
      await get()
        .deleteItem('missing')
        .catch(() => undefined);
    });

    expect(await screen.findByText("Couldn't remove that agenda item. Try again.")).toBeVisible();
  });

  it('ignores a tick for an item that is not there', async () => {
    const get = setup();

    await act(async () => get().toggleDiscussed('missing'));

    expect(get().items).toEqual([]);
  });
});

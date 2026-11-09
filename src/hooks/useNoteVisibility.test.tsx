import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as notes from '../data/notes';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { useNoteVisibility } from './useNoteVisibility';

function Harness() {
  const { setVisibility, bulkSetVisibility, getDefaultVisibility } = useNoteVisibility('alex');
  return (
    <>
      <output aria-label="default">{getDefaultVisibility()}</output>
      <button type="button" onClick={() => void setVisibility('n1', 'shared')}>
        one
      </button>
      <button type="button" onClick={() => void bulkSetVisibility('shared')}>
        all
      </button>
    </>
  );
}

describe('useNoteVisibility', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('reports the default visibility as private when nothing is set', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole('status', { name: 'default' })).toHaveTextContent('private');
  });

  it('shows an error and changes nothing when a single note cannot be changed', async () => {
    vi.spyOn(notes, 'setNoteVisibility').mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'one' }));

    expect(await screen.findByText(/Nothing was changed/)).toBeInTheDocument();
  });

  it('shows an error when the bulk change cannot be saved', async () => {
    vi.spyOn(notes, 'setVisibilityForMember').mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'all' }));

    expect(await screen.findByText(/Nothing was changed/)).toBeInTheDocument();
  });
});

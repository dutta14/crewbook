import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EncryptionProgressModal } from './EncryptionProgressModal';

describe('EncryptionProgressModal', () => {
  it('renders nothing while closed', () => {
    render(<EncryptionProgressModal isOpen={false} progress={0} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('tells the user not to close the tab and shows the progress', () => {
    render(<EncryptionProgressModal isOpen progress={0.4} />);

    const dialog = screen.getByRole('alertdialog', {
      name: 'Updating encryption — do not close this tab',
    });
    expect(dialog).toHaveFocus();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40');
  });

  it('ignores Escape and Tab so the user cannot leave it halfway', () => {
    render(<EncryptionProgressModal isOpen progress={0.5} />);

    expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(false);
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
    expect(fireEvent.keyDown(document, { key: 'a' })).toBe(true);
  });

  it('warns before the page is closed or reloaded', () => {
    render(<EncryptionProgressModal isOpen progress={0.5} />);

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('stops warning once it closes', () => {
    const { rerender } = render(<EncryptionProgressModal isOpen progress={0.5} />);
    rerender(<EncryptionProgressModal isOpen={false} progress={1} />);

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

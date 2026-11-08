import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '../hooks/useToast';
import { ToastProvider } from './Toast';

function Trigger({
  message = 'Saved',
  type = 'success',
  duration,
}: {
  message?: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(message, type, duration)}>
      Notify {message}
    </button>
  );
}

const renderProvider = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a polite status live region on document.body, even with no toasts', () => {
    const { container } = renderProvider(<p>App</p>);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(container).not.toContainElement(region);
  });

  it('shows the message passed to showToast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderProvider(<Trigger message="Member saved" />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('status')).toHaveTextContent('Member saved');
  });

  it('renders HTML in a message as text rather than markup', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const message = '<img src=x onerror=alert(1)> added to your team';
    renderProvider(<Trigger message={message} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('status').querySelector('img')).toBeNull();
  });

  it('applies the type variant', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderProvider(<Trigger message="Failed" type="error" />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Failed').closest('.toast')).toHaveClass('toast--error');
  });

  it('stacks newest toasts on top', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderProvider(
      <>
        <Trigger message="First" />
        <Trigger message="Second" />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Notify First' }));
    await user.click(screen.getByRole('button', { name: 'Notify Second' }));

    const messages = Array.from(
      screen.getByRole('status').querySelectorAll('.toast__message'),
      (node) => node.textContent,
    );
    expect(messages).toEqual(['Second', 'First']);
  });

  it('auto-dismisses after 5 seconds by default', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderProvider(<Trigger message="Bye" />);
    await user.click(screen.getByRole('button'));

    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(screen.getByText('Bye')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText('Bye')).not.toBeInTheDocument();
  });

  it('auto-dismisses after a custom duration', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderProvider(<Trigger message="Quick" duration={1000} />);
    await user.click(screen.getByRole('button'));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.queryByText('Quick')).not.toBeInTheDocument();
  });

  it('dismisses a toast manually with the dismiss button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderProvider(<Trigger message="Manual" />);
    await user.click(screen.getByRole('button', { name: 'Notify Manual' }));

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText('Manual', { selector: '.toast__message' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations with a toast showing', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderProvider(<Trigger message="Accessible" />);
    await user.click(screen.getByRole('button'));

    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe('useToast', () => {
  it('throws a helpful error outside a ToastProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Trigger />)).toThrow('useToast must be used within a ToastProvider');
  });
});

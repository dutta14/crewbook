import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('secret internal detail');
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders the generic fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('does not expose the error message in the fallback UI', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
  });

  it('logs the error and component stack to console.error', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(consoleError).toHaveBeenCalledWith(
      'ErrorBoundary caught a render error',
      expect.objectContaining({ message: 'secret internal detail' }),
      expect.stringContaining('Boom'),
    );
  });

  it('does not log the error or component stack itself when silent', () => {
    render(
      <ErrorBoundary silent fallback={null}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(consoleError).not.toHaveBeenCalledWith(
      'ErrorBoundary caught a render error',
      expect.anything(),
      expect.anything(),
    );
  });

  it('renders a custom fallback instead of the default UI when provided', () => {
    render(
      <ErrorBoundary fallback={<p>Custom fallback</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('reloads the page when the reload button is clicked', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: 'Reload page' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations in the fallback state', async () => {
    const { container } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

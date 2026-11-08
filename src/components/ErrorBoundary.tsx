import { Component, type ErrorInfo, type ReactNode } from 'react';
import '../styles/button.css';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  fallback?: ReactNode;
  /** Skips the console report, for subtrees whose errors could carry private content. */
  silent?: boolean;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.silent) return;
    console.error('ErrorBoundary caught a render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    // Deliberately generic: error details and component names stay out of the UI.
    return (
      <div className="error-boundary" role="alert">
        <h2 className="error-boundary__title">Something went wrong</h2>
        <p className="error-boundary__message">Reload the page to try again.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}

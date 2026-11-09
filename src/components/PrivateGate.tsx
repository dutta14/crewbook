import type { ReactNode } from 'react';
import { usePrivateEnvelope } from '../hooks/usePrivateEnvelope';
import '../styles/form.css';
import '../styles/connections.css';

/** Connections live in the private envelope, so it is opened before anything is read. */
export function PrivateGate({ label, children }: { label: string; children: ReactNode }) {
  const { isReady, loadFailed } = usePrivateEnvelope();

  if (loadFailed) {
    return (
      <p className="form-error" role="alert">
        {`Couldn't open ${label}. Lock and unlock Crewbook to try again.`}
      </p>
    );
  }
  if (!isReady) return <p className="connections__loading">{`Opening ${label}…`}</p>;
  return <>{children}</>;
}

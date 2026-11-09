import { useEffect, useRef } from 'react';
import { NetworkView } from '../components/NetworkView';
import { PrivateGate } from '../components/PrivateGate';
import '../styles/connections.css';

/** Manager-only, and rendered only once the manager navigates here. */
export function NetworkPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="connections-page__title">
        Network
      </h1>
      <p className="connections-page__notice">Contains sensitive relationship data</p>
      <PrivateGate label="connections">
        <NetworkView />
      </PrivateGate>
    </>
  );
}

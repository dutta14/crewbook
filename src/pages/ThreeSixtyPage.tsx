import { useEffect, useRef } from 'react';
import { PrivateGate } from '../components/PrivateGate';
import { ThreeSixtyPlanning } from '../components/ThreeSixtyPlanning';
import { useTeamConnections } from '../hooks/useConnections';
import '../styles/connections.css';

/** Manager-only. There is no link to one person's plan: the page always starts with nobody chosen. */
export function ThreeSixtyPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="connections-page__title">
        360 Planning
      </h1>
      <PrivateGate label="connections">
        <LoadedPlanning />
      </PrivateGate>
    </>
  );
}

function LoadedPlanning() {
  const { members, connections } = useTeamConnections();
  return <ThreeSixtyPlanning members={members} connections={connections} />;
}

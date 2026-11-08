import { useMemo } from 'react';
import { DashboardReminders } from '../components/DashboardReminders';
import { GapAlertCard } from '../components/GapAlert';
import { TodaysOneOnes } from '../components/TodaysOneOnes';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import '../styles/dashboard.css';

export function Dashboard() {
  const storage = useEncryptedStorage();
  const members = useMemo(() => listMembers(storage), [storage]);

  return (
    <>
      <h1>Dashboard</h1>
      <h2 className="sr-only">Today</h2>
      <div className="dashboard__grid">
        <TodaysOneOnes members={members} />
        <GapAlertCard members={members} />
        <DashboardReminders />
      </div>
    </>
  );
}

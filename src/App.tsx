import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EncryptedStorageProvider } from './components/EncryptedStorageProvider';
import { LockGate } from './components/LockGate';
import { ToastProvider } from './components/Toast';
import { Calendar } from './pages/Calendar';
import { Dashboard } from './pages/Dashboard';
import { DecisionsGlobalView } from './pages/DecisionsGlobalView';
import { Feedback } from './pages/Feedback';
import { GlobalActions } from './pages/GlobalActions';
import { Profile } from './pages/Profile';
import { Roster } from './pages/Roster';
import { Settings } from './pages/Settings';
import { SkillsMatrixPage } from './pages/SkillsMatrixPage';
import { TeamTenure } from './pages/TeamTenure';
import { Todos } from './pages/Todos';

// Split out so the recipient of a share link loads none of the manager's pages.
const SharedOneOnOne = lazy(() =>
  import('./pages/SharedOneOnOne').then((module) => ({ default: module.SharedOneOnOne })),
);

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <EncryptedStorageProvider>
          <Routes>
            {/* Outside the lock gate: a recipient has no passphrase and sees only the link's data. */}
            <Route
              path="/shared/:token?"
              element={
                <Suspense fallback={null}>
                  <SharedOneOnOne />
                </Suspense>
              }
            />
            <Route element={<LockGate />}>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="roster" element={<Roster />} />
                <Route path="team/tenure" element={<TeamTenure />} />
                <Route path="skills-matrix" element={<SkillsMatrixPage />} />
                <Route path="person/:id" element={<Profile />} />
                <Route path="actions" element={<GlobalActions />} />
                <Route path="decisions" element={<DecisionsGlobalView />} />
                <Route path="feedback" element={<Feedback />} />
                <Route path="tasks" element={<Todos />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </EncryptedStorageProvider>
      </ToastProvider>
    </HashRouter>
  );
}

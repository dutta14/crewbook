import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EncryptedStorageProvider } from './components/EncryptedStorageProvider';
import { LockGate } from './components/LockGate';
import { ToastProvider } from './components/Toast';
import { Calendar } from './pages/Calendar';
import { Dashboard } from './pages/Dashboard';
import { DecisionsGlobalView } from './pages/DecisionsGlobalView';
import { GlobalActions } from './pages/GlobalActions';
import { Profile } from './pages/Profile';
import { Roster } from './pages/Roster';
import { Settings } from './pages/Settings';
import { TeamTenure } from './pages/TeamTenure';
import { Todos } from './pages/Todos';

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <EncryptedStorageProvider>
          <LockGate>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="roster" element={<Roster />} />
                <Route path="team/tenure" element={<TeamTenure />} />
                <Route path="person/:id" element={<Profile />} />
                <Route path="actions" element={<GlobalActions />} />
                <Route path="decisions" element={<DecisionsGlobalView />} />
                <Route path="tasks" element={<Todos />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </LockGate>
        </EncryptedStorageProvider>
      </ToastProvider>
    </HashRouter>
  );
}

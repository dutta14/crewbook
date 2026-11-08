import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EncryptedStorageProvider } from './components/EncryptedStorageProvider';
import { LockGate } from './components/LockGate';
import { ToastProvider } from './components/Toast';
import { GlobalActions } from './pages/GlobalActions';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { Profile } from './pages/Profile';
import { Roster } from './pages/Roster';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <EncryptedStorageProvider>
          <LockGate>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<PlaceholderPage title="Dashboard" />} />
                <Route path="roster" element={<Roster />} />
                <Route path="person/:id" element={<Profile />} />
                <Route path="actions" element={<GlobalActions />} />
                <Route path="calendar" element={<PlaceholderPage title="Calendar" />} />
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

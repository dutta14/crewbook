import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EncryptedStorageProvider } from './components/EncryptedStorageProvider';
import { LockGate } from './components/LockGate';
import { ToastProvider } from './components/Toast';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { Roster } from './pages/Roster';

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
                <Route path="person/:id" element={<PlaceholderPage title="Profile" />} />
                <Route path="calendar" element={<PlaceholderPage title="Calendar" />} />
                <Route path="settings" element={<PlaceholderPage title="Settings" />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </LockGate>
        </EncryptedStorageProvider>
      </ToastProvider>
    </HashRouter>
  );
}

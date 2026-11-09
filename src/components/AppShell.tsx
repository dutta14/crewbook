import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getDateFormat } from '../data/settings';
import { useDarkMode } from '../hooks/useDarkMode';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { setActiveDateFormat } from '../utils/startDate';
import { ErrorBoundary } from './ErrorBoundary';
import { FeedbackFab } from './FeedbackFab';
import { MenuIcon } from './icons';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { isDark, toggle } = useDarkMode();
  const storage = useEncryptedStorage();
  // Read during render so dates drawn below already follow the saved format.
  setActiveDateFormat(getDateFormat(storage));
  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpen = useRef(false);

  useEffect(() => {
    if (isMenuOpen) {
      closeButtonRef.current?.focus();
    } else if (wasMenuOpen.current) {
      menuButtonRef.current?.focus();
    }
    wasMenuOpen.current = isMenuOpen;
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  const handleNavigate = useCallback(() => {
    if (!isMenuOpen) return;
    // The menu button would otherwise steal focus back; a navigation should land in the content.
    wasMenuOpen.current = false;
    setIsMenuOpen(false);
    mainRef.current?.focus();
  }, [isMenuOpen]);

  const handleSkipLink = (event: MouseEvent<HTMLAnchorElement>) => {
    // The hash belongs to HashRouter, so the anchor must not navigate.
    event.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={handleSkipLink}>
        Skip to main content
      </a>
      <Sidebar
        isOpen={isMenuOpen}
        isDark={isDark}
        onClose={closeMenu}
        onNavigate={handleNavigate}
        onToggleDark={toggle}
        closeButtonRef={closeButtonRef}
      />
      <div>
        <div className="app-topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="icon-btn"
            aria-label="Open navigation"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
        <main id="main-content" ref={mainRef} className="app-main" tabIndex={-1}>
          <div className="app-content">
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
        <FeedbackFab />
      </div>
    </div>
  );
}

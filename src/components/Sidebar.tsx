import type { ReactNode, RefObject } from 'react';
import { NavLink } from 'react-router-dom';
import '../styles/button.css';
import {
  CalendarIcon,
  ChecklistIcon,
  ClipboardIcon,
  CloseIcon,
  DashboardIcon,
  GavelIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  TeamIcon,
} from './icons';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon />, end: true },
  { to: '/roster', label: 'Team', icon: <TeamIcon /> },
  { to: '/actions', label: 'Action Items', icon: <ChecklistIcon /> },
  { to: '/decisions', label: 'Decisions & Follow-ups', icon: <GavelIcon /> },
  { to: '/tasks', label: 'Tasks', icon: <ClipboardIcon /> },
  { to: '/calendar', label: 'Calendar', icon: <CalendarIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

interface SidebarProps {
  isOpen: boolean;
  isDark: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onToggleDark: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}

export function Sidebar({
  isOpen,
  isDark,
  onClose,
  onNavigate,
  onToggleDark,
  closeButtonRef,
}: SidebarProps) {
  return (
    <>
      <div className="sidebar-backdrop" data-open={isOpen} role="presentation" onClick={onClose} />
      <div className="sidebar" data-open={isOpen}>
        <div className="sidebar__header">
          <span className="sidebar__logo">Crewbook</span>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-btn sidebar__close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="sidebar__nav" aria-label="Main navigation">
          <ul className="sidebar__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="sidebar__link" onClick={onNavigate}>
                  {item.icon}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar__footer">
          <button
            type="button"
            className="icon-btn theme-toggle"
            aria-label="Toggle dark mode"
            aria-pressed={isDark}
            onClick={onToggleDark}
          >
            <span className="theme-toggle__icon" data-active={!isDark}>
              <MoonIcon />
            </span>
            <span className="theme-toggle__icon" data-active={isDark}>
              <SunIcon />
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

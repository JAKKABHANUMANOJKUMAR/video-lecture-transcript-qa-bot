import React from 'react';
import { LektaLogo } from './LektaLogo';
import {
  MessageSquarePlus,
  BookOpen,
  Clock,
  LifeBuoy,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { IconButton } from './ui';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const MENU = [
  { id: 'chat', label: 'New chat', icon: MessageSquarePlus },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'complaint', label: 'Get help', icon: LifeBuoy },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const UserSidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpen,
  onToggle,
}) => {
  const { user, profile, signOut } = useAuth();

  const displayName = user?.fullName || profile?.fullName || 'User';
  const initials =
    (user?.fullName || profile?.fullName || user?.email || 'U')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U';

  // Only collapse the drawer on mobile. Firing this on desktop used to leave
  // the sidebar in the "open" state, so shrinking the window revealed an
  // already-open drawer plus its overlay.
  const selectTab = (id: string) => {
    onTabChange(id);
    if (window.matchMedia('(max-width: 767px)').matches) onToggle();
  };

  return (
    <>
      <IconButton
        icon={isOpen ? X : Menu}
        label={isOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isOpen}
        onClick={onToggle}
        className="md:hidden fixed top-3 left-3 z-50 bg-surface border border-line shadow-e2"
      />

      {/* Flex column, not absolute positioning — the old footer was pinned with
          `absolute bottom-6`, so on short viewports it overlapped the nav. */}
      <aside
        aria-label="Main"
        className={`fixed md:relative top-0 left-0 h-screen w-64 shrink-0 z-40
          flex flex-col bg-surface border-r border-line
          transition-transform duration-300 ease-ease
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
          <LektaLogo size={30} />
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-content">Lekta</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
          {MENU.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                  text-sm font-medium text-left transition-colors duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                  ${isActive
                    ? 'bg-accent-soft text-accent-ink'
                    : 'text-content-muted hover:bg-surface-sunk hover:text-content'}`}
              >
                {/* Active gets a rail as well as a tint, so the state survives
                    greyscale and colour-blindness. */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent"
                    aria-hidden="true"
                  />
                )}
                <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 p-3 border-t border-line flex flex-col gap-1">
          <div className="flex items-center gap-3 px-2 py-2">
            <span
              className="w-9 h-9 shrink-0 rounded-md grid place-items-center
                bg-accent text-white text-xs font-bold"
              aria-hidden="true"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-content truncate">{displayName}</p>
              {user?.email && (
                <p className="text-[11.5px] text-content-muted truncate">{user.email}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md
              text-sm font-medium text-content-muted text-left
              hover:bg-danger-soft hover:text-danger-ink transition-colors duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      {/* A real button, so the drawer is dismissible by keyboard. */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onToggle}
          className="fixed inset-0 bg-ink-900/50 md:hidden z-30 cursor-default"
        />
      )}
    </>
  );
};

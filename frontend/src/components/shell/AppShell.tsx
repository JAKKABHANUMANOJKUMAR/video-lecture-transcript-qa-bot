import React, { useCallback, useEffect, useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { cx } from '../../lib/cx';
import { LektaLogo } from '../LektaLogo';
import {
  Sidebar,
  type NavAction,
  type NavItem,
  type RecentsPanel,
} from './Sidebar';
import { CommandBar, type CommandActions } from './CommandBar';

const COLLAPSE_KEY = 'lekta_sidebar_collapsed';

/**
 * The Lekta shell: a persistent sidebar on the left, the page on the right,
 * and the ⌘K command bar over the top of both.
 *
 * The sidebar owns navigation, the recent-session list and the account menu;
 * the shell owns the collapse/drawer state and the page container.
 */
export function AppShell<V extends string>({
  items,
  active,
  onNavigate,
  action,
  recents,
  commandActions,
  onOpenProfile,
  onOpenSettings,
  children,
}: {
  items: NavItem<V>[];
  active: V;
  onNavigate: (view: V) => void;
  /** Primary one-shot action pinned above the destinations. */
  action?: NavAction;
  /** Inline conversation list. Omitted on surfaces that have no sessions. */
  recents?: RecentsPanel;
  commandActions: CommandActions;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  children: React.ReactNode;
}) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  );

  const toggleCollapse = useCallback(() => {
    setCollapsed((v) => {
      localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      return !v;
    });
  }, []);

  // Global ⌘K / Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Any navigation closes the mobile drawer — you asked to go somewhere.
  const closeDrawer = useCallback(() => setMobileOpen(false), []);
  useEffect(() => {
    closeDrawer();
  }, [active, closeDrawer]);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        items={items}
        active={active}
        onNavigate={onNavigate}
        action={action}
        recents={recents}
        onOpenSearch={() => {
          setCmdOpen(true);
          closeDrawer();
        }}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={closeDrawer}
      />

      {/* Mobile top bar — the only way back to the drawer. */}
      <div className="glass sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line/70 px-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-ctl p-2 text-ink-2 transition-colors duration-micro hover:bg-canvas-deep/70 hover:text-ink"
        >
          <PanelLeft size={19} />
        </button>
        <LektaLogo size={24} />
        <span className="font-display text-body font-semibold text-ink">Lekta</span>
      </div>

      {/* Page container — cleared of the sidebar, which is fixed. */}
      <main
        key={active}
        className={cx(
          'animate-rise px-4 pb-16 pt-6 sm:px-8 md:pr-8 md:pt-8',
          'transition-[padding] duration-panel ease-study',
          collapsed ? 'md:pl-[96px]' : 'md:pl-[296px]',
        )}
      >
        {children}
      </main>

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} actions={commandActions} />
    </div>
  );
}

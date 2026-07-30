import React, { useRef, useState } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  LogOut,
  Pencil,
  Search,
  Settings as SettingsIcon,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { cx } from '../../lib/cx';
import { Avatar, Kbd, Menu, MenuItem, MenuSeparator } from '../ui';
import { LektaLogo } from '../LektaLogo';

/* ------------------------------------------------------------------- types */

export interface NavItem<V extends string = string> {
  view: V;
  label: string;
  icon: LucideIcon;
}

/** A one-shot action row (New session) — not a destination. */
export interface NavAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Highlighted while the fresh, unsaved session is on screen. */
  active?: boolean;
}

export interface RecentItem {
  id: string;
  title: string;
  subtitle?: string;
}

/** The inline conversation list — the thing that makes this feel like a chat app. */
export interface RecentsPanel {
  items: RecentItem[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Rename a conversation. Called only with a non-empty, changed title. */
  onRename?: (id: string, title: string) => void;
  onSeeAll: () => void;
  /** Shown in place of the list when there is nothing yet. */
  emptyHint: string;
  /** True while the first fetch is still in flight. */
  loading?: boolean;
}

/* ------------------------------------------------------------------- parts */

/** Label that flies out to the right when the rail is collapsed. */
function Flyout({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-chip bg-ink px-2 py-1 text-[11.5px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-micro group-hover/row:opacity-100 md:block">
      {children}
    </span>
  );
}

function Row({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
  trailing,
  strokeWidth = 1.9,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
  strokeWidth?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'group/row relative flex w-full items-center rounded-ctl text-sm font-semibold transition-colors duration-micro ease-study',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-accent-tint text-accent-deep'
          : 'text-ink-2 hover:bg-canvas-deep/70 hover:text-ink',
      )}
    >
      <Icon size={18} strokeWidth={strokeWidth} className="shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!collapsed && trailing}
      {collapsed && <Flyout>{label}</Flyout>}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-4 text-micro uppercase tracking-wider text-ink-3">{children}</p>
  );
}

/**
 * One conversation in the list. The rename and delete controls are sibling
 * buttons rather than nested ones — a button inside a button is invalid markup.
 *
 * Rename happens in place: the row becomes an input. Enter commits, Escape
 * abandons, and clicking away commits (what you typed is what you meant).
 */
function RecentRow({
  item,
  active,
  onOpen,
  onDelete,
  onRename,
}: {
  item: RecentItem;
  active: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onRename?: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  // Escape must not be undone by the blur that follows it.
  const abandoned = useRef(false);

  const startEdit = () => {
    setDraft(item.title);
    abandoned.current = false;
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (abandoned.current) {
      abandoned.current = false;
      return;
    }
    const next = draft.trim();
    // An empty name would leave an unclickable blank row.
    if (next && next !== item.title) onRename?.(next);
  };

  if (editing) {
    return (
      <div className="px-0.5 py-0.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              abandoned.current = true;
              setEditing(false);
            }
          }}
          aria-label={`Rename session: ${item.title}`}
          className="w-full rounded-input border border-accent-soft bg-surface px-2.5 py-1.5 text-sm text-ink shadow-ring focus:outline-none"
        />
      </div>
    );
  }

  const controls = (onRename ? 1 : 0) + (onDelete ? 1 : 0);

  return (
    <div className="group/recent relative">
      <button
        onClick={onOpen}
        aria-current={active ? 'page' : undefined}
        title={item.title}
        className={cx(
          'flex w-full items-center rounded-ctl py-2 pl-3 text-left text-sm transition-colors duration-micro ease-study',
          controls === 2 ? 'pr-16' : controls === 1 ? 'pr-9' : 'pr-3',
          active
            ? 'bg-accent-tint font-semibold text-accent-deep'
            : 'text-ink-2 hover:bg-canvas-deep/70 hover:text-ink',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
      </button>
      {controls > 0 && (
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-micro focus-within:opacity-100 group-hover/recent:opacity-100">
          {onRename && (
            <button
              onClick={startEdit}
              aria-label={`Rename session: ${item.title}`}
              title="Rename"
              className="rounded-chip p-1.5 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep hover:text-ink"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Delete session: ${item.title}`}
              title="Delete"
              className="rounded-chip p-1.5 text-ink-3 transition-colors duration-micro hover:bg-rose-tint hover:text-rose-ink"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- sidebar */

/**
 * The Lekta sidebar: a persistent left column in the shape people already know
 * from chat apps — the new-session action and destinations up top, every recent
 * conversation listed inline beneath, and your account anchored at the bottom
 * behind a popup.
 *
 * Collapses to an icon rail on desktop; slides in as a drawer on mobile.
 */
export function Sidebar<V extends string>({
  items,
  active,
  onNavigate,
  action,
  recents,
  onOpenSearch,
  onOpenProfile,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  items: NavItem<V>[];
  active: V;
  onNavigate: (view: V) => void;
  action?: NavAction;
  recents?: RecentsPanel;
  onOpenSearch: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { user, profile, signOut } = useAuth();
  const name = profile?.fullName || user?.fullName || user?.email || 'You';

  // Recents are a list of labels — meaningless without room for the labels.
  const showRecents = recents && !collapsed;

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm animate-fade-in md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        aria-label="Primary"
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface',
          'transition-[transform,width] duration-panel ease-study',
          // Mobile: off-canvas drawer at a fixed width.
          'w-[280px]',
          mobileOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full',
          // Desktop: always on, width follows the collapsed state.
          'md:translate-x-0 md:shadow-none',
          collapsed ? 'md:w-[72px]' : 'md:w-[272px]',
        )}
      >
        {/* ------------------------------------------------------- header */}
        <div
          className={cx(
            'flex h-16 shrink-0 items-center border-b border-line',
            collapsed ? 'md:justify-center md:px-0' : 'px-3',
          )}
        >
          <button
            onClick={() => onNavigate(items[0].view)}
            aria-label="Lekta home"
            className={cx(
              'flex items-center gap-2.5 rounded-ctl px-1.5 py-1.5 transition-colors duration-micro hover:bg-canvas-deep/70',
              collapsed && 'md:px-1.5',
            )}
          >
            <LektaLogo size={28} />
            {!collapsed && (
              <span className="font-display text-lg font-semibold text-ink">Lekta</span>
            )}
          </button>

          <div className="ml-auto flex items-center gap-1">
            {/* Desktop collapse toggle */}
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cx(
                'hidden rounded-ctl p-2 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep/70 hover:text-ink md:block',
                collapsed && 'md:hidden',
              )}
            >
              <ChevronsLeft size={17} />
            </button>
            {/* Mobile close */}
            <button
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="rounded-ctl p-2 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep/70 hover:text-ink md:hidden"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Expand affordance while collapsed — the header has no room for it. */}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="group/row relative mx-2 mt-2 hidden justify-center rounded-ctl py-2 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep/70 hover:text-ink md:flex"
          >
            <ChevronsRight size={17} />
            <Flyout>Expand sidebar</Flyout>
          </button>
        )}

        {/* --------------------------------------------------- top actions */}
        <div className="space-y-0.5 px-2 pt-2">
          {action && (
            <Row
              icon={action.icon}
              label={action.label}
              active={action.active}
              collapsed={collapsed}
              onClick={action.onClick}
              strokeWidth={2.25}
            />
          )}

          {items.map((item) => (
            <Row
              key={item.view}
              icon={item.icon}
              label={item.label}
              active={item.view === active}
              collapsed={collapsed}
              onClick={() => onNavigate(item.view)}
            />
          ))}

          <Row
            icon={Search}
            label="Search"
            collapsed={collapsed}
            onClick={onOpenSearch}
            trailing={<Kbd>⌘K</Kbd>}
          />
        </div>

        {/* -------------------------------------------------- recent list */}
        {showRecents ? (
          <div className="mt-1 flex min-h-0 flex-1 flex-col">
            <SectionLabel>Recents</SectionLabel>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
              {recents.loading ? (
                <div className="space-y-1.5 px-1 py-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-8 rounded-ctl" />
                  ))}
                </div>
              ) : recents.items.length === 0 ? (
                <p className="px-3 py-2 text-cap leading-relaxed text-ink-3">{recents.emptyHint}</p>
              ) : (
                recents.items.map((r) => (
                  <RecentRow
                    key={r.id}
                    item={r}
                    active={recents.activeId === r.id}
                    onOpen={() => recents.onOpen(r.id)}
                    onDelete={recents.onDelete ? () => recents.onDelete?.(r.id) : undefined}
                    onRename={
                      recents.onRename ? (title) => recents.onRename?.(r.id, title) : undefined
                    }
                  />
                ))
              )}
            </div>
            {recents.items.length > 0 && (
              <button
                onClick={recents.onSeeAll}
                className="mx-2 mb-2 shrink-0 rounded-ctl px-3 py-2 text-left text-cap font-semibold text-ink-3 transition-colors duration-micro hover:bg-canvas-deep/70 hover:text-ink"
              >
                All sessions →
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* ------------------------------------------------------ profile */}
        <div className="shrink-0 border-t border-line p-2">
          <Menu
            direction="up"
            align="start"
            className="w-full"
            trigger={(open) => (
              <button
                aria-label="Account menu"
                className={cx(
                  'group/row relative flex w-full items-center rounded-ctl transition-colors duration-micro ease-study',
                  collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2 py-2',
                  open ? 'bg-canvas-deep/70' : 'hover:bg-canvas-deep/70',
                )}
              >
                <Avatar name={name} size={collapsed ? 30 : 32} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                      <span className="block truncate text-cap text-ink-3">{user?.email}</span>
                    </span>
                    <ChevronUp
                      size={15}
                      className={cx(
                        'shrink-0 text-ink-3 transition-transform duration-micro ease-study',
                        open && 'rotate-180',
                      )}
                    />
                  </>
                )}
                {collapsed && <Flyout>{name}</Flyout>}
              </button>
            )}
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="truncate text-cap text-ink-3">{user?.email}</p>
            </div>
            <MenuSeparator />
            {onOpenProfile && (
              <MenuItem icon={<UserRound size={15} />} onClick={onOpenProfile}>
                Profile
              </MenuItem>
            )}
            {onOpenSettings && (
              <MenuItem icon={<SettingsIcon size={15} />} onClick={onOpenSettings}>
                Settings
              </MenuItem>
            )}
            {(onOpenProfile || onOpenSettings) && <MenuSeparator />}
            <MenuItem danger icon={<LogOut size={15} />} onClick={() => void signOut()}>
              Sign out
            </MenuItem>
          </Menu>
        </div>
      </aside>
    </>
  );
}

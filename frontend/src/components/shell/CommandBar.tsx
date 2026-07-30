import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Sparkles,
  Video,
  MessageSquare,
  Library,
  History,
  LifeBuoy,
  Settings,
  CornerDownLeft,
} from 'lucide-react';
import { cx } from '../../lib/cx';
import { api, type ApiVideo, type ApiChatSession } from '../../lib/api';
import { Kbd, Spinner, StatusBadge } from '../ui';

export interface CommandActions {
  onNavigate: (view: string) => void;
  onNewSession: () => void;
  onResumeChat: (id: string) => void;
  onAskLecture: (video: ApiVideo) => void;
  /** Admin docks pass nav-only commands. */
  navOnly?: boolean;
  navItems: Array<{ view: string; label: string }>;
}

interface Row {
  id: string;
  group: 'Actions' | 'Lectures' | 'Chats';
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  run: () => void;
}

/**
 * ⌘K / Ctrl+K command bar: one place to search lectures, resume chats, and go
 * anywhere. Opens on shortcut or via the shell search pill.
 */
export function CommandBar({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: CommandActions;
}) {
  const [q, setQ] = useState('');
  const [videos, setVideos] = useState<ApiVideo[] | null>(null);
  const [chats, setChats] = useState<ApiChatSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load searchable data when the palette opens (user side only).
  useEffect(() => {
    if (!open) return;
    setQ('');
    setCursor(0);
    window.setTimeout(() => inputRef.current?.focus(), 10);
    if (actions.navOnly) return;
    setLoading(true);
    Promise.allSettled([api.listVideos(), api.listChats()]).then(([v, c]) => {
      setVideos(v.status === 'fulfilled' ? v.value : []);
      setChats(c.status === 'fulfilled' ? c.value : []);
      setLoading(false);
    });
  }, [open, actions.navOnly]);

  const rows = useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    const match = (s: string | null | undefined) =>
      !needle || (s ?? '').toLowerCase().includes(needle);

    const out: Row[] = [];
    if (!actions.navOnly && match('new session ask question')) {
      out.push({
        id: 'act-new',
        group: 'Actions',
        icon: <Sparkles size={16} className="text-accent" />,
        title: 'Start a new session',
        run: actions.onNewSession,
      });
    }
    for (const n of actions.navItems) {
      if (!match(n.label)) continue;
      const icons: Record<string, React.ReactNode> = {
        library: <Library size={16} />,
        sessions: <History size={16} />,
        support: <LifeBuoy size={16} />,
        settings: <Settings size={16} />,
      };
      out.push({
        id: `nav-${n.view}`,
        group: 'Actions',
        icon: icons[n.view] ?? <CornerDownLeft size={16} />,
        title: `Go to ${n.label}`,
        run: () => actions.onNavigate(n.view),
      });
    }
    for (const v of videos ?? []) {
      if (!match(v.title) && !match(v.subject)) continue;
      out.push({
        id: `vid-${v.id}`,
        group: 'Lectures',
        icon: <Video size={16} className="text-peach-ink" />,
        title: v.title,
        meta: <StatusBadge status={v.status} />,
        run: () => actions.onAskLecture(v),
      });
    }
    for (const c of chats ?? []) {
      if (!match(c.title) && !match(c.video_name)) continue;
      out.push({
        id: `chat-${c.id}`,
        group: 'Chats',
        icon: <MessageSquare size={16} className="text-sky-ink" />,
        title: c.title || 'Untitled session',
        meta: c.video_name ? (
          <span className="truncate text-cap text-ink-3">{c.video_name}</span>
        ) : undefined,
        run: () => actions.onResumeChat(c.id),
      });
    }
    return out.slice(0, 24);
  }, [q, videos, chats, actions]);

  useEffect(() => setCursor(0), [rows.length]);

  // Keyboard: arrows + enter + esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(rows.length - 1, c + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (e.key === 'Enter' && rows[cursor]) {
        e.preventDefault();
        rows[cursor].run();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, rows, cursor, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let lastGroup: string | null = null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command bar">
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-panel border border-line bg-surface shadow-lg animate-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={17} className="shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={actions.navOnly ? 'Where to?' : 'Search lectures, chats, or type a command…'}
            className="h-14 w-full bg-transparent text-body text-ink placeholder:text-ink-3 focus:outline-none"
            style={{ boxShadow: 'none' }}
          />
          {loading ? <Spinner size={15} /> : <Kbd>esc</Kbd>}
        </div>
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
          {rows.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-3">
              Nothing matches “{q}” yet.
            </p>
          )}
          {rows.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <React.Fragment key={r.id}>
                {header && (
                  <p className="px-3 pb-1 pt-3 text-micro uppercase tracking-wider text-ink-3">
                    {header}
                  </p>
                )}
                <button
                  data-idx={i}
                  onClick={() => {
                    r.run();
                    onClose();
                  }}
                  onMouseEnter={() => setCursor(i)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-ctl px-3 py-2.5 text-left transition-colors duration-micro',
                    i === cursor ? 'bg-accent-tint' : 'hover:bg-canvas',
                  )}
                >
                  <span className="shrink-0 text-ink-2">{r.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.title}</span>
                  {r.meta}
                  {i === cursor && <CornerDownLeft size={14} className="shrink-0 text-ink-3" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Home as HomeIcon,
  Library as LibraryIcon,
  LifeBuoy,
  LayoutDashboard,
  Users as UsersIcon,
  BarChart3,
  Bell,
  Plus,
} from 'lucide-react';
import { AuthProvider, useAuth } from './lib/auth-context';
import { api, type ApiChatSession, type ApiVideo } from './lib/api';
import { ToastProvider, useToast } from './components/ui';
import { LektaLogo } from './components/LektaLogo';
import { AppShell } from './components/shell/AppShell';
import type { NavItem } from './components/shell/Sidebar';
import type { CommandActions } from './components/shell/CommandBar';
import type { ChatSession, SessionIntent } from './components/session/types';
import { Gate } from './pages/Gate';
import { Desk } from './pages/Desk';
import { Session } from './pages/Session';
import { Shelf } from './pages/Shelf';
import { Sessions } from './pages/Sessions';
import { Support } from './pages/Support';
import { Settings } from './pages/Settings';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminAlerts } from './pages/admin/AdminAlerts';
import { AdminSettings } from './pages/admin/AdminSettings';

type UserView = 'home' | 'session' | 'library' | 'sessions' | 'support' | 'settings';
type AdminView = 'overview' | 'users' | 'analytics' | 'alerts' | 'settings';

function fromApiChat(s: ApiChatSession): ChatSession {
  return {
    id: s.id,
    title: s.title,
    messages: s.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'bot',
      content: m.content,
    })),
    videoName: s.video_name ?? '',
    videoId: s.video_id,
    step: s.step,
    updatedAt: new Date(s.updated_at).getTime(),
    transcriptId: s.transcript_id,
    mediaKey: s.video_id ?? s.transcript_id,
    transcript: null,
  };
}

/**
 * Destinations only. The session view is reached by starting one or picking a
 * recent; settings lives behind the account popup at the foot of the sidebar.
 */
const USER_NAV: NavItem<UserView>[] = [
  { view: 'home', label: 'Home', icon: HomeIcon },
  { view: 'library', label: 'Library', icon: LibraryIcon },
  { view: 'support', label: 'Support', icon: LifeBuoy },
];

const ADMIN_NAV: NavItem<AdminView>[] = [
  { view: 'overview', label: 'Overview', icon: LayoutDashboard },
  { view: 'users', label: 'Users', icon: UsersIcon },
  { view: 'analytics', label: 'Analytics', icon: BarChart3 },
  { view: 'alerts', label: 'Alerts', icon: Bell },
];

function UserApp() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<UserView>('home');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);
  const [intent, setIntent] = useState<SessionIntent | null>(null);
  const [chatsLoaded, setChatsLoaded] = useState(false);

  /** Server truth (a freshly fetched chat) replaces the local copy wholesale. */
  const persistSession = useCallback((session: ChatSession) => {
    setChatSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = session;
        return copy;
      }
      return [session, ...prev];
    });
  }, []);

  /**
   * Session-driven persistence. The conversation owns its messages and video
   * metadata, but not its *name*: a title is derived once at creation and after
   * that only a rename changes it, so an existing title is never overwritten.
   *
   * `previousId` is the provisional client id a session had before the server
   * assigned a real one — dropping it stops the list showing the same
   * conversation twice.
   */
  const mergeSession = useCallback((session: ChatSession, previousId?: string) => {
    setChatSessions((prev) => {
      const base =
        previousId && previousId !== session.id
          ? prev.filter((s) => s.id !== previousId)
          : prev;
      const idx = base.findIndex((s) => s.id === session.id);
      if (idx < 0) return [session, ...base];
      const copy = [...base];
      copy[idx] = { ...session, title: base[idx].title || session.title };
      return copy;
    });
  }, []);

  // Initial + on-demand chat list refresh.
  useEffect(() => {
    api
      .listChats()
      .then((chats) => setChatSessions(chats.map(fromApiChat)))
      .catch(() => setChatSessions([]))
      .finally(() => setChatsLoaded(true));
  }, []);

  useEffect(() => {
    if (view === 'sessions') {
      api
        .listChats()
        .then((chats) => setChatSessions(chats.map(fromApiChat)))
        .catch(() => {});
    }
  }, [view]);

  const openChat = useCallback(
    async (id: string) => {
      try {
        const chat = await api.getChat(id);
        persistSession(fromApiChat(chat));
      } catch {
        /* fall back to the cached session */
      }
      setIntent(null);
      setActiveChatId(id);
      setView('session');
    },
    [persistSession],
  );

  const deleteSession = useCallback(async (id: string) => {
    try {
      await api.deleteChat(id);
    } catch {
      /* ignore */
    }
    setChatSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveChatId((cur) => (cur === id ? null : cur));
  }, []);

  /**
   * Rename a conversation. Applied locally first so the sidebar responds
   * immediately, then persisted; a failed write is rolled back rather than
   * left showing a name the database doesn't have.
   */
  const renameSession = useCallback(
    async (id: string, title: string) => {
      let previous: string | null = null;
      setChatSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          previous = s.title;
          return { ...s, title };
        }),
      );
      try {
        await api.updateChat(id, { title });
      } catch (err) {
        if (previous !== null) {
          setChatSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, title: previous as string } : s)),
          );
        }
        toast(
          'danger',
          'Could not rename the session',
          err instanceof Error ? err.message : undefined,
        );
      }
    },
    [toast],
  );

  /** Start a fresh session, optionally seeded with an ingest/lecture intent. */
  const startSession = useCallback((next: SessionIntent | null) => {
    setIntent(next);
    setActiveChatId(null);
    setSessionNonce((n) => n + 1);
    setView('session');
  }, []);

  const askLecture = useCallback(
    (v: ApiVideo) => {
      api.markVideoAccessed(v.id).catch(() => {});
      startSession({ lecture: { id: v.id, title: v.title } });
    },
    [startSession],
  );

  const commandActions: CommandActions = {
    onNavigate: (v) => setView(v as UserView),
    onNewSession: () => startSession(null),
    onResumeChat: (id) => void openChat(id),
    onAskLecture: askLecture,
    navItems: [
      { view: 'home', label: 'Home' },
      { view: 'library', label: 'Library' },
      { view: 'sessions', label: 'Recent sessions' },
      { view: 'support', label: 'Support' },
      { view: 'settings', label: 'Settings' },
    ],
  };

  const name = profile?.fullName || user?.fullName || 'there';

  // The sidebar's inline conversation list — newest first, the rest a click away.
  const recentItems = useMemo(
    () =>
      [...chatSessions]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12)
        .map((s) => ({ id: s.id, title: s.title || 'Untitled session' })),
    [chatSessions],
  );

  return (
    <AppShell
      items={USER_NAV}
      active={view}
      onNavigate={setView}
      action={{
        label: 'New session',
        icon: Plus,
        onClick: () => startSession(null),
        active: view === 'session' && activeChatId === null,
      }}
      recents={{
        items: recentItems,
        activeId: view === 'session' ? activeChatId : null,
        onOpen: (id) => void openChat(id),
        onDelete: (id) => void deleteSession(id),
        onRename: (id, title) => void renameSession(id, title),
        onSeeAll: () => setView('sessions'),
        emptyHint: 'Your conversations will appear here as you study.',
        loading: !chatsLoaded,
      }}
      commandActions={commandActions}
      onOpenProfile={() => setView('settings')}
      onOpenSettings={() => setView('settings')}
    >
      {view === 'home' && (
        <Desk
          userName={name}
          sessions={chatSessions}
          onResume={(id) => void openChat(id)}
          onStart={startSession}
          onGoLibrary={() => setView('library')}
          onGoSessions={() => setView('sessions')}
        />
      )}
      {/* The Session stays mounted while you browse — an in-flight upload or
          answer keeps running when you visit the Library and come back. */}
      <div className={view === 'session' ? undefined : 'hidden'}>
        <Session
          key={activeChatId ?? `new-${sessionNonce}`}
          initialSession={
            activeChatId ? chatSessions.find((s) => s.id === activeChatId) ?? null : null
          }
          intent={intent}
          onConsumeIntent={() => setIntent(null)}
          onPersist={mergeSession}
        />
      </div>
      {view === 'library' && <Shelf onAskLecture={askLecture} />}
      {view === 'sessions' && (
        <Sessions
          sessions={chatSessions}
          onOpen={(id) => void openChat(id)}
          onDelete={(id) => void deleteSession(id)}
          onNew={() => startSession(null)}
        />
      )}
      {view === 'support' && <Support />}
      {view === 'settings' && <Settings />}
    </AppShell>
  );
}

function AdminApp() {
  const [view, setView] = useState<AdminView>('overview');

  const commandActions: CommandActions = {
    onNavigate: (v) => setView(v as AdminView),
    onNewSession: () => {},
    onResumeChat: () => {},
    onAskLecture: () => {},
    navOnly: true,
    navItems: [
      ...ADMIN_NAV.map((d) => ({ view: d.view, label: d.label })),
      { view: 'settings', label: 'Settings' },
    ],
  };

  return (
    <AppShell
      items={ADMIN_NAV}
      active={view}
      onNavigate={setView}
      commandActions={commandActions}
      onOpenProfile={() => setView('settings')}
      onOpenSettings={() => setView('settings')}
    >
      {view === 'overview' && <AdminOverview onNavigate={setView} />}
      {view === 'users' && <AdminUsers />}
      {view === 'analytics' && <AdminAnalytics />}
      {view === 'alerts' && <AdminAlerts />}
      {view === 'settings' && <AdminSettings />}
    </AppShell>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="animate-pulse-soft">
          <LektaLogo size={56} />
        </div>
      </div>
    );
  }

  if (!user) return <Gate />;
  if (profile?.role === 'admin') return <AdminApp />;
  return <UserApp />;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

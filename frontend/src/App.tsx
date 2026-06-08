import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminAlerts } from './pages/AdminAlerts';
import { AdminUsers } from './pages/AdminUsers';
import { AdminAnalytics } from './pages/AdminAnalytics';
import { AdminSettings } from './pages/AdminSettings';
import { AdminSidebar } from './components/AdminSidebar';
import { UserDashboard, type ChatSession } from './pages/UserDashboard';
import { UserLibrary } from './pages/UserLibrary';
import { UserRecent } from './pages/UserRecent';
import { UserComplaints } from './pages/UserComplaints';
import { UserSettings } from './pages/UserSettings';
import { UserSidebar } from './components/UserSidebar';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // User chat session history (shared between New Chat and Recent)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newChatNonce, setNewChatNonce] = useState(0);

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

  const openChat = (id: string) => {
    setActiveChatId(id);
    setActiveTab('chat');
  };

  const deleteSession = (id: string) => {
    setChatSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveChatId((cur) => (cur === id ? null : cur));
  };

  // Land non-admin users directly on the New Chat page after login
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      setActiveTab('chat');
    }
  }, [profile]);

  const handleUserTab = (tab: string) => {
    if (tab === 'chat') {
      setActiveChatId(null);
      setNewChatNonce((n) => n + 1);
    }
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (profile?.role === 'admin') {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="flex-1 overflow-auto">
          {activeTab === 'alerts' ? (
            <AdminAlerts />
          ) : activeTab === 'users' ? (
            <AdminUsers />
          ) : activeTab === 'analytics' ? (
            <AdminAnalytics />
          ) : activeTab === 'settings' ? (
            <AdminSettings />
          ) : (
            <AdminDashboard />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900">
      <UserSidebar
        activeTab={activeTab}
        onTabChange={handleUserTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex-1 overflow-auto">
        {activeTab === 'library' ? (
          <UserLibrary onOpenChat={() => handleUserTab('chat')} />
        ) : activeTab === 'recent' ? (
          <UserRecent
            sessions={chatSessions}
            onOpen={openChat}
            onDelete={deleteSession}
            onNewChat={() => handleUserTab('chat')}
          />
        ) : activeTab === 'complaint' ? (
          <UserComplaints />
        ) : activeTab === 'settings' ? (
          <UserSettings />
        ) : (
          <UserDashboard
            key={activeChatId ?? `new-${newChatNonce}`}
            initialSession={activeChatId ? chatSessions.find((s) => s.id === activeChatId) ?? null : null}
            onPersist={persistSession}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

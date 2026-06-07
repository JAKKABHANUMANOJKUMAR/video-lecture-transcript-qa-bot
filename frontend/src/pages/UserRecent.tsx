import React, { useMemo, useState } from 'react';
import { MessageSquare, Search, Trash2, ArrowRight, Video, Plus, Clock } from 'lucide-react';
import type { ChatSession } from './UserDashboard';

interface UserRecentProps {
  sessions: ChatSession[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

const STEP_LABELS = ['Analysis', 'Planning', 'Review'];

const formatTime = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

export const UserRecent: React.FC<UserRecentProps> = ({ sessions, onOpen, onDelete, onNewChat }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.videoName.toLowerCase().includes(q) ||
        s.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [sessions, search]);

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Recent Chats</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Resume a past conversation and continue where you left off</p>
        </div>
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="p-8">
        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your chat history..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-500 mb-4">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {sessions.length === 0 ? 'No chats yet' : 'No matching chats'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              {sessions.length === 0
                ? 'Start a new chat from the New Chat page. Your conversations will appear here so you can continue them anytime.'
                : 'Try a different search term.'}
            </p>
            {sessions.length === 0 && (
              <button
                onClick={onNewChat}
                className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition"
              >
                <Plus className="w-4 h-4" />
                Start a New Chat
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((session) => {
              const lastMessage = session.messages[session.messages.length - 1];
              return (
                <button
                  key={session.id}
                  onClick={() => onOpen(session.id)}
                  className="group text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-500 flex-shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 transition"
                      title="Delete chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-4 line-clamp-1">
                    {session.title}
                  </h3>
                  {lastMessage && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {lastMessage.content}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {session.videoName && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <Video className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">{session.videoName}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                      {STEP_LABELS[session.step] ?? 'Analysis'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(session.updatedAt)}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 group-hover:gap-2 transition-all">
                      Continue
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

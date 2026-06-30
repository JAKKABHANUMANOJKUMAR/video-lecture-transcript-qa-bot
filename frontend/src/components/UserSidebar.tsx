import React from 'react';
import {
  MessageSquare,
  BookOpen,
  Clock,
  AlertCircle,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const UserSidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpen,
  onToggle,
}) => {
  const { user, profile, signOut } = useAuth();

  const displayName = user?.fullName || profile?.fullName || 'User';
  const initials = (user?.fullName || profile?.fullName || user?.email || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const menuItems = [
    { id: 'chat', label: 'new chat', icon: MessageSquare },
    { id: 'library', label: 'library', icon: BookOpen },
    { id: 'recent', label: 'recent', icon: Clock },
    { id: 'complaint', label: 'raise complaint', icon: AlertCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={onToggle}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed md:relative top-0 left-0 h-screen bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 z-40 ${
          isOpen ? 'w-64' : '-translate-x-full md:translate-x-0 md:w-64'
        }`}
      >
        <div className="p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">AO</span>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">Ask Ora</span>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    onToggle();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition capitalize ${
                    isActive
                      ? 'bg-slate-900 dark:bg-indigo-500 text-white'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User details + Logout */}
        <div className="absolute bottom-6 left-6 right-6 space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {displayName}
              </p>
              {user?.email && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              )}
              {profile?.role && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-500/20">
                  {profile.role}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg font-medium transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
};

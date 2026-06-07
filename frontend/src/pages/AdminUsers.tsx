import React, { useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Eye,
  Ban,
  CheckCircle2,
  X,
  User,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../lib/theme-context';

type UserStatus = 'Active' | 'Offline' | 'Blocked';

interface UserRecord {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  usageTime: string;
  lastLogin: string;
  joined: string;
  role: string;
  totalSessions: number;
}

const INITIAL_USERS: UserRecord[] = [
  { id: 'U-1001', username: 'John Doe', email: 'john@example.com', status: 'Active', usageTime: '4h 12m', lastLogin: '2 min ago', joined: 'Jan 12, 2026', role: 'Student', totalSessions: 184 },
  { id: 'U-1002', username: 'Jane Smith', email: 'jane@example.com', status: 'Offline', usageTime: '2h 48m', lastLogin: '5 hours ago', joined: 'Feb 03, 2026', role: 'Student', totalSessions: 96 },
  { id: 'U-1003', username: 'Mike Johnson', email: 'mike@example.com', status: 'Blocked', usageTime: '38m', lastLogin: '3 days ago', joined: 'Feb 21, 2026', role: 'Student', totalSessions: 22 },
  { id: 'U-1004', username: 'Sarah Williams', email: 'sarah@example.com', status: 'Active', usageTime: '6h 05m', lastLogin: 'Just now', joined: 'Dec 28, 2025', role: 'Educator', totalSessions: 240 },
  { id: 'U-1005', username: 'David Brown', email: 'david@example.com', status: 'Offline', usageTime: '1h 22m', lastLogin: '1 day ago', joined: 'Mar 09, 2026', role: 'Student', totalSessions: 58 },
  { id: 'U-1006', username: 'Emily Davis', email: 'emily@example.com', status: 'Active', usageTime: '3h 47m', lastLogin: '12 min ago', joined: 'Jan 30, 2026', role: 'Student', totalSessions: 132 },
  { id: 'U-1007', username: 'Chris Wilson', email: 'chris@example.com', status: 'Offline', usageTime: '52m', lastLogin: '2 days ago', joined: 'Apr 02, 2026', role: 'Student', totalSessions: 41 },
  { id: 'U-1008', username: 'Olivia Martinez', email: 'olivia@example.com', status: 'Active', usageTime: '5h 18m', lastLogin: '3 min ago', joined: 'Nov 15, 2025', role: 'Educator', totalSessions: 201 },
  { id: 'U-1009', username: 'Daniel Lee', email: 'daniel@example.com', status: 'Blocked', usageTime: '14m', lastLogin: '1 week ago', joined: 'Apr 18, 2026', role: 'Student', totalSessions: 9 },
  { id: 'U-1010', username: 'Sophia Garcia', email: 'sophia@example.com', status: 'Offline', usageTime: '2h 09m', lastLogin: '8 hours ago', joined: 'Feb 11, 2026', role: 'Student', totalSessions: 77 },
  { id: 'U-1011', username: 'James Rodriguez', email: 'james@example.com', status: 'Active', usageTime: '4h 56m', lastLogin: '20 min ago', joined: 'Jan 05, 2026', role: 'Student', totalSessions: 165 },
  { id: 'U-1012', username: 'Mia Hernandez', email: 'mia@example.com', status: 'Offline', usageTime: '1h 03m', lastLogin: '2 days ago', joined: 'Mar 22, 2026', role: 'Student', totalSessions: 34 },
  { id: 'U-1013', username: 'William Lopez', email: 'william@example.com', status: 'Active', usageTime: '3h 31m', lastLogin: '7 min ago', joined: 'Dec 10, 2025', role: 'Educator', totalSessions: 158 },
  { id: 'U-1014', username: 'Ava Gonzalez', email: 'ava@example.com', status: 'Blocked', usageTime: '27m', lastLogin: '5 days ago', joined: 'Apr 25, 2026', role: 'Student', totalSessions: 15 },
  { id: 'U-1015', username: 'Ethan Clark', email: 'ethan@example.com', status: 'Offline', usageTime: '2h 40m', lastLogin: '11 hours ago', joined: 'Feb 28, 2026', role: 'Student', totalSessions: 88 },
  { id: 'U-1016', username: 'Isabella Lewis', email: 'isabella@example.com', status: 'Active', usageTime: '5h 49m', lastLogin: '1 min ago', joined: 'Nov 30, 2025', role: 'Student', totalSessions: 213 },
];

const STATUS_FILTERS: ('All' | UserStatus)[] = ['All', 'Active', 'Offline', 'Blocked'];
const PAGE_SIZE = 6;

const statusDot: Record<UserStatus, string> = {
  Active: 'bg-green-500',
  Offline: 'bg-slate-400',
  Blocked: 'bg-red-500',
};

const statusBadge: Record<UserStatus, string> = {
  Active: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  Offline: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  Blocked: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | UserStatus>('All');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const { isDark, setTheme } = useTheme();

  const summary = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'Active').length;
    const inactive = users.filter((u) => u.status !== 'Active').length;
    return { total, active, inactive };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== 'All' && u.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!u.username.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [users, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetToFirstPage = () => setPage(1);

  const toggleBlock = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === 'Blocked' ? 'Offline' : 'Blocked' }
          : u
      )
    );
    setSelectedUser((cur) =>
      cur && cur.id === id
        ? { ...cur, status: cur.status === 'Blocked' ? 'Offline' : 'Blocked' }
        : cur
    );
  };

  const summaryCards = [
    {
      title: 'Total Users',
      count: summary.total,
      icon: <Users className="w-6 h-6" />,
      accent: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-500/15',
    },
    {
      title: 'Active Users',
      count: summary.active,
      icon: <UserCheck className="w-6 h-6" />,
      accent: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-50 dark:bg-green-500/15',
    },
    {
      title: 'Inactive Users',
      count: summary.inactive,
      icon: <UserX className="w-6 h-6" />,
      accent: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-500/15',
    },
  ];

  return (
    <div>
      <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Account and activity overview only — no private content is shown
            </p>
          </div>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            title="Toggle light / dark mode"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {summaryCards.map((card) => (
              <div
                key={card.title}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center ${card.accent}`}>
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{card.count}</p>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters + Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between border-b border-slate-100 dark:border-slate-700">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetToFirstPage();
                  }}
                  placeholder="Search by username or email..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStatusFilter(s);
                      resetToFirstPage();
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      statusFilter === s
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['Username', 'Email Address', 'Status', 'Usage Time', 'Last Login', 'Actions'].map((col) => (
                      <th
                        key={col}
                        className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {pagedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                            {u.username.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge[u.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[u.status]}`} />
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{u.usageTime}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{u.lastLogin}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedUser(u)}
                            title="View Details"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-md transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleBlock(u.id)}
                            title={u.status === 'Blocked' ? 'Unblock User' : 'Block User'}
                            className={`p-1.5 rounded-md transition ${
                              u.status === 'Blocked'
                                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-500/15'
                                : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15'
                            }`}
                          >
                            {u.status === 'Blocked' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pagedUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                        No users match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {filteredUsers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, filteredUsers.length)}
                </span>{' '}
                of <span className="font-medium text-slate-700 dark:text-slate-200">{filteredUsers.length}</span> users
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                      p === currentPage
                        ? 'bg-green-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* User Details Modal - account & activity info only */}
        {selectedUser && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedUser(null)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.username}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-2 gap-4">
                <DetailField label="User ID" value={selectedUser.id} />
                <DetailField label="Role" value={selectedUser.role} />
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge[selectedUser.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot[selectedUser.status]}`} />
                    {selectedUser.status}
                  </span>
                </div>
                <DetailField label="Total Usage" value={selectedUser.usageTime} />
                <DetailField label="Last Login" value={selectedUser.lastLogin} />
                <DetailField label="Member Since" value={selectedUser.joined} />
                <DetailField label="Total Sessions" value={String(selectedUser.totalSessions)} />
              </div>

              <div className="px-6 pb-4">
                <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  For privacy, user videos, transcripts, chat history, and other private content are not accessible from this panel.
                </p>
              </div>

              <div className="flex gap-2 p-6 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => toggleBlock(selectedUser.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
                    selectedUser.status === 'Blocked'
                      ? 'text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-500/15 dark:hover:bg-green-500/25'
                      : 'text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-500/15 dark:hover:bg-red-500/25'
                  }`}
                >
                  {selectedUser.status === 'Blocked' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Unblock User
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      Block User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</p>
  </div>
);

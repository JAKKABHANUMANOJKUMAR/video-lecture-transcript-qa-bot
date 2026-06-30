import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  MessageSquareWarning,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Search,
  Calendar,
  Eye,
  RefreshCw,
  CheckCheck,
  Trash2,
  Bell,
  X,
  User,
} from 'lucide-react';
import { api, ApiAlert, ApiError, formatDateTime, titleCaseStatus } from '../lib/api';

type Priority = 'Low' | 'Medium' | 'High';
type Status = 'Open' | 'In Progress' | 'Resolved';
type AlertCategory = 'complaint' | 'system' | 'security';

interface AlertRecord {
  id: string;
  type: string;
  category: AlertCategory;
  userName: string;
  userEmail: string;
  message: string;
  description: string;
  createdAt: string;
  priority: Priority;
  status: Status;
  adminNotes: string;
  history: { label: string; time: string }[];
}

interface SummaryCard {
  title: string;
  count: number;
  icon: React.ReactNode;
  accent: string;
  iconBg: string;
  trend: string;
  trendUp: boolean;
}

const FILTER_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Alerts' },
  { id: 'complaint', label: 'Complaints' },
  { id: 'system', label: 'System Alerts' },
  { id: 'security', label: 'Security Alerts' },
  { id: 'resolved', label: 'Resolved' },
];

function mapAlert(a: ApiAlert): AlertRecord {
  const statusMap: Record<string, Status> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
  };
  const priorityMap: Record<string, Priority> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  return {
    id: a.id,
    type: titleCaseStatus(a.alert_type),
    category: (a.alert_type === 'complaint' || a.alert_type === 'system' || a.alert_type === 'security'
      ? a.alert_type
      : 'system') as AlertCategory,
    userName: a.user_name || 'System',
    userEmail: '',
    message: a.message,
    description: a.admin_notes || a.message,
    createdAt: formatDateTime(a.created_at),
    priority: priorityMap[a.priority] || 'Medium',
    status: statusMap[a.status] || 'Open',
    adminNotes: a.admin_notes || '',
    history: [{ label: a.message, time: formatDateTime(a.created_at) }],
  };
}

const INITIAL_ALERTS: AlertRecord[] = [];

interface RecentNotification {
  icon: React.ReactNode;
  iconBg: string;
  description: string;
  time: string;
}

const priorityStyles: Record<Priority, string> = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
};

const statusStyles: Record<Status, string> = {
  Open: 'bg-red-100 text-red-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved: 'bg-green-100 text-green-700',
};

const STATUS_FILTERS: ('All' | Status)[] = ['All', 'Open', 'In Progress', 'Resolved'];

export const AdminAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertRecord[]>(INITIAL_ALERTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Status>('All');
  const [selectedAlert, setSelectedAlert] = useState<AlertRecord | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAlerts();
      setAlerts(data.map(mapAlert));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const summaryCards = useMemo((): SummaryCard[] => {
    const open = alerts.filter((a) => a.status === 'Open').length;
    const complaints = alerts.filter((a) => a.category === 'complaint').length;
    const system = alerts.filter((a) => a.category === 'system').length;
    const resolved = alerts.filter((a) => a.status === 'Resolved').length;
    return [
      {
        title: 'Open Alerts',
        count: open,
        icon: <AlertCircle className="w-6 h-6" />,
        accent: 'text-red-600',
        iconBg: 'bg-red-50',
        trend: `${alerts.length} total`,
        trendUp: open > 0,
      },
      {
        title: 'Complaint Alerts',
        count: complaints,
        icon: <MessageSquareWarning className="w-6 h-6" />,
        accent: 'text-amber-600',
        iconBg: 'bg-amber-50',
        trend: 'From database',
        trendUp: true,
      },
      {
        title: 'System Alerts',
        count: system,
        icon: <ShieldAlert className="w-6 h-6" />,
        accent: 'text-blue-600',
        iconBg: 'bg-blue-50',
        trend: 'Live count',
        trendUp: false,
      },
      {
        title: 'Resolved Alerts',
        count: resolved,
        icon: <CheckCircle2 className="w-6 h-6" />,
        accent: 'text-green-600',
        iconBg: 'bg-green-50',
        trend: 'All time',
        trendUp: true,
      },
    ];
  }, [alerts]);

  const recentNotifications = useMemo((): RecentNotification[] => {
    return alerts.slice(0, 5).map((a) => ({
      icon:
        a.category === 'complaint' ? (
          <MessageSquareWarning className="w-4 h-4 text-amber-600" />
        ) : a.category === 'security' ? (
          <ShieldAlert className="w-4 h-4 text-purple-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-600" />
        ),
      iconBg: 'bg-slate-50',
      description: a.message,
      time: a.createdAt,
    }));
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (activeFilter === 'resolved' && alert.status !== 'Resolved') return false;
      if (
        (activeFilter === 'complaint' || activeFilter === 'system' || activeFilter === 'security') &&
        alert.category !== activeFilter
      ) {
        return false;
      }

      if (statusFilter !== 'All' && alert.status !== statusFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          alert.id.toLowerCase().includes(q) ||
          alert.userName.toLowerCase().includes(q) ||
          alert.message.toLowerCase().includes(q) ||
          alert.type.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [alerts, activeFilter, statusFilter, search]);

  const cycleStatus = async (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;
    const next: Status =
      alert.status === 'Open' ? 'In Progress' : alert.status === 'In Progress' ? 'Resolved' : 'Open';
    const apiStatus = next.toLowerCase().replace(/ /g, '_');
    try {
      await api.updateAlert(id, { status: apiStatus });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: next } : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update alert.');
    }
  };

  const markResolved = async (id: string) => {
    try {
      await api.updateAlert(id, { status: 'resolved' });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'Resolved' } : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resolve alert.');
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await api.deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setSelectedAlert((cur) => (cur?.id === id ? null : cur));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete alert.');
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Alerts & Complaints</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Monitor, triage, and resolve platform alerts</p>
      </div>

      <div className="p-8">
        {loading && (
          <div className="mb-4 text-sm text-slate-500">Loading alerts…</div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center ${card.accent}`}>
                  {card.icon}
                </div>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${
                    card.trendUp ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {card.trendUp ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{card.count}</p>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">{card.title}</h3>
              <p className={`text-xs font-medium mt-2 ${card.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {card.trend}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main column */}
          <div className="xl:col-span-3 space-y-6">
            {/* Filters Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
              <div className="flex flex-wrap gap-2 mb-5">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                      activeFilter === tab.id
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by ID, user, type, or message..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="pl-10 pr-3 py-2.5 text-sm text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'All' | Status)}
                  className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none cursor-pointer"
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'All Statuses' : s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Alerts Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {['Alert ID', 'Alert Type', 'User Name', 'Message Summary', 'Date & Time', 'Priority', 'Status', 'Actions'].map(
                        (col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredAlerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                        <td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          {alert.id}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{alert.type}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{alert.userName}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-xs">
                          <span className="line-clamp-1">{alert.message}</span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{alert.createdAt}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityStyles[alert.priority]}`}>
                            {alert.priority}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyles[alert.status]}`}>
                            {alert.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedAlert(alert)}
                              title="View Details"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => cycleStatus(alert.id)}
                              title="Update Status"
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => markResolved(alert.id)}
                              title="Mark as Resolved"
                              className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-md transition"
                            >
                              <CheckCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              title="Delete Alert"
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAlerts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                          No alerts match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Alerts Panel */}
          <div className="xl:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 sticky top-8">
              <div className="flex items-center gap-2 mb-5">
                <Bell className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recent Alerts</h2>
              </div>
              <div className="space-y-4">
                {recentNotifications.map((note, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-lg ${note.iconBg} flex items-center justify-center flex-shrink-0`}>
                      {note.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">{note.description}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{note.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Alert Details</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{selectedAlert.id}</p>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* User Information */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedAlert.userName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedAlert.userEmail}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Alert Type" value={selectedAlert.type} />
                <DetailField label="Date Created" value={selectedAlert.createdAt} />
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Priority</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityStyles[selectedAlert.priority]}`}>
                    {selectedAlert.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Current Status</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[selectedAlert.status]}`}>
                    {selectedAlert.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">Full Description</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{selectedAlert.description}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">Admin Notes</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  {selectedAlert.adminNotes}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Resolution History</p>
                <ol className="space-y-3">
                  {selectedAlert.history.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1" />
                        {i < selectedAlert.history.length - 1 && (
                          <span className="w-px flex-1 bg-slate-200 my-1" />
                        )}
                      </div>
                      <div className="pb-1">
                        <p className="text-sm text-slate-700 dark:text-slate-200">{item.label}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{item.time}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  cycleStatus(selectedAlert.id);
                  setSelectedAlert((cur) =>
                    cur
                      ? {
                          ...cur,
                          status:
                            cur.status === 'Open'
                              ? 'In Progress'
                              : cur.status === 'In Progress'
                                ? 'Resolved'
                                : 'Open',
                        }
                      : cur
                  );
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
                Update Status
              </button>
              <button
                onClick={() => {
                  markResolved(selectedAlert.id);
                  setSelectedAlert((cur) => (cur ? { ...cur, status: 'Resolved' } : cur));
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition"
              >
                <CheckCheck className="w-4 h-4" />
                Mark as Resolved
              </button>
              <button
                onClick={() => deleteAlert(selectedAlert.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</p>
  </div>
);

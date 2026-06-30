import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Inbox,
  CircleDot,
  Loader2,
  CheckCircle2,
  Search,
  Eye,
  Send,
  RotateCcw,
  Paperclip,
  X,
  User,
} from 'lucide-react';
import { api, ApiComplaint, ApiError, formatDate, titleCaseStatus, toApiPriority } from '../lib/api';

type ComplaintStatus = 'open' | 'in_progress' | 'resolved';
type Priority = 'Low' | 'Medium' | 'High';

interface ComplaintView {
  id: string;
  ticketId: string;
  title: string;
  category: string;
  priority: Priority;
  description: string;
  submittedAt: string;
  status: ComplaintStatus;
  adminResponse: string;
  resolution: string;
  screenshot?: string;
}

const CATEGORIES = [
  'Video Upload Issue',
  'Transcript Issue',
  'Chatbot Response Issue',
  'Account Issue',
  'Technical Problem',
  'Other',
];

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

function mapComplaint(c: ApiComplaint): ComplaintView {
  return {
    id: c.id,
    ticketId: c.ticket_id,
    title: c.title,
    category: c.category,
    priority: (c.priority.charAt(0).toUpperCase() + c.priority.slice(1)) as Priority,
    description: c.description,
    submittedAt: formatDate(c.created_at),
    status: c.status as ComplaintStatus,
    adminResponse: c.admin_response || '',
    resolution: c.resolved_at ? `Resolved on ${formatDate(c.resolved_at)}` : '',
    screenshot: c.screenshot_url || undefined,
  };
}

const statusBadge: Record<string, string> = {
  open: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
};

const priorityBadge: Record<Priority, string> = {
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  High: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

const EMPTY_FORM = {
  title: '',
  category: CATEGORIES[0],
  priority: 'Medium' as Priority,
  description: '',
  screenshot: '',
};

export const UserComplaints: React.FC = () => {
  const [complaints, setComplaints] = useState<ComplaintView[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ComplaintView | null>(null);
  const [banner, setBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listComplaints();
      setComplaints(data.map(mapComplaint));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load complaints.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const stats = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter((c) => c.status === 'open').length,
    inProgress: complaints.filter((c) => c.status === 'in_progress').length,
    resolved: complaints.filter((c) => c.status === 'resolved').length,
  }), [complaints]);

  const filtered = useMemo(() => {
    if (!search.trim()) return complaints;
    const q = search.toLowerCase();
    return complaints.filter(
      (c) =>
        c.ticketId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
    );
  }, [complaints, search]);

  const summaryCards = [
    { title: 'Total Complaints', value: stats.total, icon: <Inbox className="w-6 h-6" />, accent: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/15' },
    { title: 'Open Complaints', value: stats.open, icon: <CircleDot className="w-6 h-6" />, accent: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/15' },
    { title: 'In Progress', value: stats.inProgress, icon: <Loader2 className="w-6 h-6" />, accent: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/15' },
    { title: 'Resolved', value: stats.resolved, icon: <CheckCircle2 className="w-6 h-6" />, accent: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/15' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const created = await api.createComplaint({
        title: form.title.trim(),
        category: form.category,
        priority: toApiPriority(form.priority),
        description: form.description.trim(),
        screenshot_url: form.screenshot || null,
      });
      setComplaints((prev) => [mapComplaint(created), ...prev]);
      setForm(EMPTY_FORM);
      setBanner(true);
      setTimeout(() => setBanner(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setForm((f) => ({ ...f, screenshot: file.name }));
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Raise a Complaint</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Report issues and track their resolution</p>
      </div>

      {banner && (
        <div className="mx-8 mt-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700 dark:bg-green-500/15 dark:border-green-500/30 dark:text-green-400">
          Your complaint has been submitted successfully.
        </div>
      )}

      <div className="p-8">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400">
            {error}
          </div>
        )}
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {summaryCards.map((card) => (
            <div key={card.title} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center ${card.accent}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</h3>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Create Complaint Form */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Create Complaint</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Complaint Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Brief summary of the issue"
                  className="w-full mt-1 px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full mt-1 px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Priority</label>
                  <div className="flex gap-2 mt-1">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, priority: p }))}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition ${
                          form.priority === p
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Detailed Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="Describe the issue in detail..."
                  className="w-full mt-1 px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Screenshot (Optional)</label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <Paperclip className="w-4 h-4" />
                  {form.screenshot || 'Attach a screenshot'}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  Submit Complaint
                </button>
                <button
                  type="button"
                  onClick={() => setForm(EMPTY_FORM)}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Form
                </button>
              </div>
            </form>
          </div>

          {/* Complaint History */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Complaint History</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ticket ID, title, or category..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['Ticket ID', 'Title', 'Category', 'Date', 'Status', ''].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                      </td>
                    </tr>
                  ) : filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">{c.ticketId}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-[160px]">
                        <span className="line-clamp-1">{c.title}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{c.category}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{c.submittedAt}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusBadge[c.status]}`}>
                          {titleCaseStatus(c.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(c)}
                          title="View Details"
                          className="p-1.5 rounded-md text-slate-500 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                        No complaints found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Complaint Details Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selected.title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{selected.ticketId}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Category" value={selected.category} />
                <Detail label="Submission Date" value={selected.submittedAt} />
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Priority</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityBadge[selected.priority]}`}>
                    {selected.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Current Status</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge[selected.status]}`}>
                    {titleCaseStatus(selected.status)}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">Full Description</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{selected.description}</p>
              </div>

              {selected.screenshot && (
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Attached Screenshot</p>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <Paperclip className="w-4 h-4" />
                    {selected.screenshot}
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Admin Response</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {selected.adminResponse || 'No response yet. Our team will reach out soon.'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-1">Resolution Details</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {selected.resolution || 'This complaint has not been resolved yet.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</p>
  </div>
);

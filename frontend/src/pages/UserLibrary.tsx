import React, { useMemo, useState } from 'react';
import {
  Video,
  CheckCircle2,
  Loader2,
  HardDrive,
  Search,
  Play,
  Eye,
  Trash2,
  Clock,
  CalendarDays,
  X,
  History,
} from 'lucide-react';

type VideoStatus = 'Processed' | 'Processing' | 'Failed';

interface LectureVideo {
  id: string;
  title: string;
  subject: string;
  gradient: string;
  uploadDate: string;
  duration: string;
  status: VideoStatus;
  lastAccessed: string;
  size: string;
}

const INITIAL_VIDEOS: LectureVideo[] = [
  { id: 'VID-001', title: 'Python Basics: Variables & Data Types', subject: 'Python', gradient: 'from-blue-500 to-sky-400', uploadDate: 'May 28, 2026', duration: '42:15', status: 'Processed', lastAccessed: '2 hours ago', size: '320 MB' },
  { id: 'VID-002', title: 'Python OOP & Classes Deep Dive', subject: 'Python', gradient: 'from-blue-600 to-indigo-400', uploadDate: 'May 30, 2026', duration: '58:40', status: 'Processed', lastAccessed: 'Yesterday', size: '510 MB' },
  { id: 'VID-003', title: 'C Programming: Pointers & Memory', subject: 'C', gradient: 'from-slate-600 to-slate-400', uploadDate: 'Jun 01, 2026', duration: '37:22', status: 'Processed', lastAccessed: '3 days ago', size: '280 MB' },
  { id: 'VID-004', title: 'Java Collections Framework', subject: 'Java', gradient: 'from-orange-500 to-amber-400', uploadDate: 'Jun 02, 2026', duration: '49:05', status: 'Processing', lastAccessed: 'Never', size: '430 MB' },
  { id: 'VID-005', title: 'Machine Learning: Linear Regression', subject: 'ML', gradient: 'from-emerald-500 to-green-400', uploadDate: 'Jun 03, 2026', duration: '1:02:30', status: 'Processed', lastAccessed: '5 hours ago', size: '620 MB' },
  { id: 'VID-006', title: 'ML: Neural Networks Explained', subject: 'ML', gradient: 'from-teal-500 to-emerald-400', uploadDate: 'Jun 04, 2026', duration: '55:18', status: 'Processing', lastAccessed: 'Never', size: '580 MB' },
  { id: 'VID-007', title: 'RAG: Retrieval Augmented Generation', subject: 'RAG', gradient: 'from-purple-500 to-fuchsia-400', uploadDate: 'Jun 05, 2026', duration: '46:50', status: 'Processed', lastAccessed: '1 day ago', size: '470 MB' },
  { id: 'VID-008', title: 'RAG Pipelines with Vector Databases', subject: 'RAG', gradient: 'from-violet-600 to-purple-400', uploadDate: 'Jun 06, 2026', duration: '51:12', status: 'Failed', lastAccessed: 'Never', size: '0 MB' },
  { id: 'VID-009', title: 'Java Spring Boot Fundamentals', subject: 'Java', gradient: 'from-amber-600 to-orange-400', uploadDate: 'Jun 06, 2026', duration: '1:10:05', status: 'Processed', lastAccessed: '6 hours ago', size: '710 MB' },
];

const FILTERS = ['All Videos', 'Processed', 'Processing', 'Failed', 'Recently Added'] as const;
type Filter = (typeof FILTERS)[number];

const statusBadge: Record<VideoStatus, string> = {
  Processed: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  Processing: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

interface UserLibraryProps {
  onOpenChat: () => void;
}

export const UserLibrary: React.FC<UserLibraryProps> = ({ onOpenChat }) => {
  const [videos, setVideos] = useState<LectureVideo[]>(INITIAL_VIDEOS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All Videos');
  const [selected, setSelected] = useState<LectureVideo | null>(null);

  const stats = useMemo(() => {
    const total = videos.length;
    const processed = videos.filter((v) => v.status === 'Processed').length;
    const processing = videos.filter((v) => v.status === 'Processing').length;
    const storageMb = videos.reduce((sum, v) => sum + parseInt(v.size) || 0, 0);
    return {
      total,
      processed,
      processing,
      storage: storageMb >= 1024 ? `${(storageMb / 1024).toFixed(1)} GB` : `${storageMb} MB`,
    };
  }, [videos]);

  const filtered = useMemo(() => {
    let list = videos;
    if (filter === 'Processed') list = list.filter((v) => v.status === 'Processed');
    else if (filter === 'Processing') list = list.filter((v) => v.status === 'Processing');
    else if (filter === 'Failed') list = list.filter((v) => v.status === 'Failed');
    else if (filter === 'Recently Added') list = [...list].slice(-4).reverse();

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) => v.title.toLowerCase().includes(q) || v.subject.toLowerCase().includes(q)
      );
    }
    return list;
  }, [videos, filter, search]);

  const recentlyViewed = useMemo(
    () => videos.filter((v) => v.lastAccessed !== 'Never').slice(0, 4),
    [videos]
  );

  const deleteVideo = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    setSelected((cur) => (cur?.id === id ? null : cur));
  };

  const statusIcon = (status: VideoStatus) => {
    if (status === 'Processed') return <CheckCircle2 className="w-3.5 h-3.5" />;
    if (status === 'Processing') return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    return <X className="w-3.5 h-3.5" />;
  };

  const summaryCards = [
    { title: 'Total Videos', value: stats.total, icon: <Video className="w-6 h-6" />, accent: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/15' },
    { title: 'Processed Videos', value: stats.processed, icon: <CheckCircle2 className="w-6 h-6" />, accent: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/15' },
    { title: 'Processing Videos', value: stats.processing, icon: <Loader2 className="w-6 h-6" />, accent: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/15' },
    { title: 'Total Storage Used', value: stats.storage, icon: <HardDrive className="w-6 h-6" />, accent: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/15' },
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Video Library</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Your processed lecture videos and transcripts</p>
      </div>

      <div className="p-8">
        {/* Statistics Cards */}
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

        {/* Search & Filter */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos by title or subject..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    filter === f
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Video Grid */}
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Video Library</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {filtered.map((video) => (
            <div
              key={video.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col"
            >
              {/* Thumbnail */}
              <div className={`relative h-36 bg-gradient-to-br ${video.gradient} flex items-center justify-center`}>
                <span className="text-white/90 text-lg font-bold tracking-wide">{video.subject}</span>
                <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/40 text-white text-xs font-medium">
                  <Clock className="w-3 h-3" />
                  {video.duration}
                </span>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">
                  {video.title}
                </h3>
                <div className="mt-2 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {video.uploadDate}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[video.status]}`}>
                    {statusIcon(video.status)}
                    {video.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  Last accessed: {video.lastAccessed}
                </p>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={onOpenChat}
                    disabled={video.status !== 'Processed'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Open Chat
                  </button>
                  <button
                    onClick={() => setSelected(video)}
                    title="View Details"
                    className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteVideo(video.id)}
                    title="Delete Video"
                    className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-slate-400">
              No videos match your search or filter.
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <History className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="space-y-3">
            {recentlyViewed.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 transition"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${v.gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {v.subject}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{v.title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Viewed {v.lastAccessed}</p>
                </div>
                <button
                  onClick={onOpenChat}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition"
                >
                  Open Chat
                </button>
              </div>
            ))}
            {recentlyViewed.length === 0 && (
              <p className="text-sm text-slate-400">No recently viewed videos yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Video Details Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`relative h-40 bg-gradient-to-br ${selected.gradient} flex items-center justify-center`}>
              <span className="text-white text-2xl font-bold">{selected.subject}</span>
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-black/30 text-white hover:bg-black/50 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selected.title}</h2>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Detail label="Video ID" value={selected.id} />
                <Detail label="Subject" value={selected.subject} />
                <Detail label="Upload Date" value={selected.uploadDate} />
                <Detail label="Duration" value={selected.duration} />
                <Detail label="File Size" value={selected.size} />
                <Detail label="Last Accessed" value={selected.lastAccessed} />
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[selected.status]}`}>
                    {statusIcon(selected.status)}
                    {selected.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setSelected(null);
                    onOpenChat();
                  }}
                  disabled={selected.status !== 'Processed'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  Open Chat
                </button>
                <button
                  onClick={() => deleteVideo(selected.id)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-500/15 dark:hover:bg-red-500/25 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
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

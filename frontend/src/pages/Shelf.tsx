import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Download,
  HardDrive,
  History,
  Info,
  LibraryBig,
  MessageSquareText,
  RotateCw,
  SearchX,
  Timer,
  Trash2,
} from 'lucide-react';
import {
  api,
  formatDate,
  formatDateTime,
  formatRelative,
  titleCaseStatus,
  type ApiVideo,
} from '../lib/api';
import { mediaDownloadUrl, rag, type TranscriptDetail } from '../lib/rag';
import { cx } from '../lib/cx';
import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  SearchInput,
  Skeleton,
  StatusBadge,
  Tag,
  formatTime,
  type Tone,
} from '../components/ui';

/** Decorative mini waveform strip for lecture cards (Desk idiom, local copy). */
function WaveStrip({ seed, className }: { seed: string; className?: string }) {
  const bars = useMemo(() => {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return Array.from({ length: 28 }, (_, i) => 25 + ((h * (i + 3)) % 71));
  }, [seed]);
  return (
    <div className={cx('flex h-8 items-end gap-[2px]', className)} aria-hidden>
      {bars.map((v, i) => (
        <i key={i} className="w-[3px] rounded-full bg-peach/70" style={{ height: `${v}%` }} />
      ))}
    </div>
  );
}

function formatStorage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

/* ------------------------------------------------------------- downloading */

/** Strip characters Windows/macOS reject in filenames. */
function safeFilename(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 120);
  return cleaned || 'lecture';
}

/** Render a transcript as a readable plain-text file. */
function transcriptToText(t: TranscriptDetail, fallbackTitle: string): string {
  const heading = t.title || fallbackTitle;
  const lines = [
    heading,
    '='.repeat(heading.length),
    `Language: ${t.language.toUpperCase()}`,
    `Duration: ${formatTime(t.duration_seconds)}`,
  ];
  if (t.source_url) lines.push(`Source:   ${t.source_url}`);
  lines.push('');

  const original = (t.original_text || '').trim();
  const english = (t.english_text || '').trim();
  if (!t.is_english && english && english !== original) {
    lines.push('--- Original ---', '', original, '', '--- English translation ---', '', english);
  } else {
    lines.push(english || original);
  }
  return lines.join('\n');
}

function clickDownload(href: string, filename?: string) {
  const a = document.createElement('a');
  a.href = href;
  if (filename) a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type FilterKey = 'all' | 'processed' | 'processing' | 'failed' | 'recent';

const FILTERS: { key: FilterKey; label: string; tone: Tone }[] = [
  { key: 'all', label: 'All', tone: 'accent' },
  { key: 'processed', label: 'Processed', tone: 'mint' },
  { key: 'processing', label: 'Processing', tone: 'butter' },
  { key: 'failed', label: 'Failed', tone: 'rose' },
  { key: 'recent', label: 'Recently added', tone: 'sky' },
];

const STAT_TONES: Record<Tone, string> = {
  accent: 'bg-accent-tint text-accent-deep',
  peach: 'bg-peach-tint text-peach-ink',
  mint: 'bg-mint-tint text-mint-ink',
  sky: 'bg-sky-tint text-sky-ink',
  butter: 'bg-butter-tint text-butter-ink',
  rose: 'bg-rose-tint text-rose-ink',
  neutral: 'bg-canvas-deep text-ink-2',
};

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl',
          STAT_TONES[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-h3 leading-none text-ink">{value}</p>
        <p className="mt-1 text-cap text-ink-3">{label}</p>
      </div>
    </Card>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="shrink-0 text-cap text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink">{children}</dd>
    </div>
  );
}

/**
 * The Shelf — Lekta's library. Every lecture ever brought in, searchable and
 * filterable, one click away from a scoped conversation.
 */
export function Shelf({ onAskLecture }: { onAskLecture: (v: ApiVideo) => void }) {
  const [videos, setVideos] = useState<ApiVideo[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [detail, setDetail] = useState<ApiVideo | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ApiVideo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError('');
    setVideos(null);
    api
      .listVideos()
      .then(setVideos)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : 'Could not load your lectures.'),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------------------------------------- derived */

  const list = videos ?? [];

  const counts = useMemo(
    () => ({
      all: list.length,
      processed: list.filter((v) => v.status === 'processed').length,
      processing: list.filter((v) => v.status === 'processing').length,
      failed: list.filter((v) => v.status === 'failed').length,
      recent: Math.min(4, list.length),
    }),
    [list],
  );

  const storageMb = useMemo(() => list.reduce((acc, v) => acc + (v.size_mb || 0), 0), [list]);

  const recentlyViewed = useMemo(
    () =>
      list
        .filter((v) => v.last_accessed)
        .sort(
          (a, b) =>
            new Date(b.last_accessed as string).getTime() -
            new Date(a.last_accessed as string).getTime(),
        )
        .slice(0, 4),
    [list],
  );

  const query = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const searched = query
      ? list.filter(
          (v) =>
            v.title.toLowerCase().includes(query) ||
            (v.subject ?? '').toLowerCase().includes(query),
        )
      : list;
    if (filter === 'all') return searched;
    if (filter === 'recent') {
      const recentIds = new Set(list.slice(0, 4).map((v) => v.id));
      return searched.filter((v) => recentIds.has(v.id));
    }
    return searched.filter((v) => v.status === filter);
  }, [list, query, filter]);

  const browsing = query !== '' || filter !== 'all';

  /* ------------------------------------------------------------- actions */

  // The fix for the v1 gap: hand the whole lecture to the Session so the chat
  // opens scoped to it (video_id + player), not just "the chat tab".
  const ask = useCallback(
    (v: ApiVideo) => {
      if (v.status !== 'processed') return;
      api.markVideoAccessed(v.id).catch(() => {});
      const now = new Date().toISOString();
      setVideos((prev) =>
        prev ? prev.map((x) => (x.id === v.id ? { ...x, last_accessed: now } : x)) : prev,
      );
      setDetail(null);
      onAskLecture(v);
    },
    [onAskLecture],
  );

  /**
   * Save a lecture to disk: the transcript as a .txt built here, and the video
   * itself streamed straight from the RAG service as an attachment.
   */
  const download = useCallback(async (v: ApiVideo) => {
    if (v.status !== 'processed') return;
    setActionError('');
    setDownloadingId(v.id);
    try {
      const transcript = await rag.getTranscriptByVideo(v.id);

      const blob = new Blob([transcriptToText(transcript, v.title)], {
        type: 'text/plain;charset=utf-8',
      });
      const blobUrl = URL.createObjectURL(blob);
      clickDownload(blobUrl, `${safeFilename(transcript.title || v.title)}.txt`);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

      const videoHref = mediaDownloadUrl(v.id);
      if (videoHref) {
        // Stagger it — back-to-back downloads get dropped by some browsers.
        setTimeout(() => clickDownload(videoHref), 400);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't download that lecture.",
      );
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const confirmDelete = async () => {
    const target = confirmTarget;
    if (!target || deleting) return;
    setDeleting(true);
    setActionError('');
    try {
      await api.deleteVideo(target.id);
      // Best-effort RAG cleanup (transcript, vectors, media) — backend delete wins.
      rag.deleteVideo(target.id).catch(() => {});
      setVideos((prev) => (prev ? prev.filter((v) => v.id !== target.id) : prev));
      setDetail((d) => (d?.id === target.id ? null : d));
      setConfirmTarget(null);
    } catch (err) {
      setConfirmTarget(null);
      setDetail(null);
      setActionError(
        err instanceof Error ? err.message : "Couldn't take that lecture off the shelf.",
      );
    } finally {
      setDeleting(false);
    }
  };

  /* -------------------------------------------------------------- render */

  const header = (
    <header>
      <p className="text-cap font-semibold uppercase tracking-wider text-accent-deep">Library</p>
      <h1 className="mt-1 font-display text-h1 text-ink">The Shelf</h1>
      <p className="mt-1 text-sm text-ink-2">
        Every lecture you&rsquo;ve brought in, indexed and ready to be asked about.
      </p>
    </header>
  );

  // Loading — skeletons shaped like the loaded page.
  if (videos === null && !loadError) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-card" />
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
          <Skeleton className="h-11 w-full rounded-ctl md:max-w-sm" />
          <Skeleton className="h-7 w-72 max-w-full rounded-full" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  // Load failure — readable message + retry.
  if (videos === null) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <Card className="mt-6 p-8 text-center" role="alert">
          <p className="text-body font-semibold text-ink">The shelf couldn&rsquo;t be reached.</p>
          <p className="mt-1 text-sm text-ink-2">{loadError}</p>
          <div className="mt-5 flex justify-center">
            <Button variant="secondary" icon={<RotateCw size={14} />} onClick={load}>
              Try again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // True empty — no lectures at all yet.
  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <EmptyState
          className="mt-10"
          tone="peach"
          icon={<LibraryBig size={28} />}
          title="Your shelf is waiting for its first lecture…"
          body="Head to Home and upload a recording or paste a YouTube / Drive link. Every lecture you add lands here, ready for questions."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {header}

      {actionError && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 rounded-ctl bg-rose-tint px-4 py-2.5 animate-fade-in"
        >
          <p className="text-sm text-rose-ink">{actionError}</p>
          <Button variant="ghost" size="sm" onClick={() => setActionError('')}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Summary stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Shelf summary">
        <Stat icon={<LibraryBig size={18} />} label="Lectures" value={String(counts.all)} tone="accent" />
        <Stat icon={<CheckCircle2 size={18} />} label="Processed" value={String(counts.processed)} tone="mint" />
        <Stat icon={<Timer size={18} />} label="Processing" value={String(counts.processing)} tone="butter" />
        <Stat icon={<HardDrive size={18} />} label="On disk" value={formatStorage(storageMb)} tone="peach" />
      </section>

      {/* Search + filters */}
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or subject…"
          aria-label="Search lectures by title or subject"
          className="w-full md:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter lectures">
          {FILTERS.map((f) => (
            <Tag
              key={f.key}
              tone={f.tone}
              interactive
              active={filter === f.key}
              role="button"
              tabIndex={0}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFilter(f.key);
                }
              }}
              className="outline-none focus-visible:shadow-ring"
            >
              {f.label}
              <span className="opacity-60 tabular-nums">{counts[f.key]}</span>
            </Tag>
          ))}
        </div>
      </div>

      {/* Recently viewed strip — hidden while searching or filtering */}
      {!browsing && recentlyViewed.length > 0 && (
        <section className="mt-8" aria-label="Recently viewed">
          <h2 className="mb-3 text-h3 text-ink">Recently viewed</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentlyViewed.map((v) => {
              const open = () => (v.status === 'processed' ? ask(v) : setDetail(v));
              return (
                <Card
                  key={v.id}
                  interactive
                  className="p-3.5"
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') open();
                  }}
                >
                  <p className="line-clamp-1 text-sm font-bold text-ink" title={v.title}>
                    {v.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <Tag tone="neutral" icon={<History size={11} />}>
                      {formatRelative(v.last_accessed)}
                    </Tag>
                    <span className="text-cap font-semibold text-accent-deep">
                      {v.status === 'processed' ? 'Ask →' : 'Details →'}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Lecture grid */}
      <section className="mt-8" aria-label="All lectures">
        {!browsing && recentlyViewed.length > 0 && (
          <h2 className="mb-3 text-h3 text-ink">Everything on the shelf</h2>
        )}
        {visible.length === 0 ? (
          <EmptyState
            tone="sky"
            icon={<SearchX size={26} />}
            title="Nothing on the shelf matches"
            body={
              query
                ? `No lecture title or subject matches “${search.trim()}”. Try a shorter word, or clear the search.`
                : 'No lectures with this status right now — they may have moved on. Try another filter.'
            }
            action={
              <Button
                variant="soft"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Show every lecture
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((v) => {
              const processed = v.status === 'processed';
              return (
                <Card key={v.id} className="flex flex-col p-4">
                  <WaveStrip seed={v.id} />
                  <div className="mt-2.5 flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold text-ink" title={v.title}>
                      {v.title}
                    </p>
                    <StatusBadge status={titleCaseStatus(v.status)} className="shrink-0" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Tag tone="sky">{v.subject || 'Lecture'}</Tag>
                    <Tag tone="neutral" icon={<Clock3 size={11} />}>
                      {formatTime(v.duration_seconds)}
                    </Tag>
                    <Tag tone="neutral" icon={<HardDrive size={11} />}>
                      {formatStorage(v.size_mb)}
                    </Tag>
                  </div>
                  <div className="mt-auto pt-3">
                    <div className="flex items-center justify-between gap-2 text-cap text-ink-3">
                      <span>Added {formatDate(v.created_at)}</span>
                      <span>
                        {v.last_accessed
                          ? `Opened ${formatRelative(v.last_accessed)}`
                          : 'Not opened yet'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-3">
                      <span
                        className="flex-1"
                        title={processed ? undefined : 'Available once processing finishes'}
                      >
                        <Button
                          size="sm"
                          className="w-full"
                          icon={<MessageSquareText size={13} />}
                          disabled={!processed}
                          onClick={() => ask(v)}
                        >
                          Ask about this
                        </Button>
                      </span>
                      <span
                        title={
                          processed
                            ? 'Download video and transcript'
                            : 'Available once processing finishes'
                        }
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Download ${v.title} video and transcript`}
                          disabled={!processed || downloadingId === v.id}
                          onClick={() => download(v)}
                        >
                          {downloadingId === v.id ? (
                            <RotateCw size={14} className="animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                        </Button>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Details for ${v.title}`}
                        onClick={() => setDetail(v)}
                      >
                        <Info size={14} />
                      </Button>
                      <Button
                        variant="danger"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Delete ${v.title}`}
                        onClick={() => setConfirmTarget(v)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Details dialog */}
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Lecture details"
        footer={
          detail ? (
            <>
              <Button
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={() => setConfirmTarget(detail)}
              >
                Delete
              </Button>
              <span
                title={
                  detail.status === 'processed'
                    ? 'Download video and transcript'
                    : 'Available once processing finishes'
                }
              >
                <Button
                  variant="soft"
                  icon={
                    downloadingId === detail.id ? (
                      <RotateCw size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )
                  }
                  disabled={detail.status !== 'processed' || downloadingId === detail.id}
                  onClick={() => download(detail)}
                >
                  Download
                </Button>
              </span>
              <span
                title={
                  detail.status === 'processed'
                    ? undefined
                    : 'Available once processing finishes'
                }
              >
                <Button
                  icon={<MessageSquareText size={14} />}
                  disabled={detail.status !== 'processed'}
                  onClick={() => ask(detail)}
                >
                  Ask about this
                </Button>
              </span>
            </>
          ) : undefined
        }
      >
        {detail && (
          <div>
            <WaveStrip seed={detail.id} className="h-10" />
            <p className="mt-3 text-body font-bold text-ink">{detail.title}</p>
            <dl className="mt-3">
              <DetailRow label="Subject">{detail.subject || 'Lecture'}</DetailRow>
              <DetailRow label="Status">
                <StatusBadge status={titleCaseStatus(detail.status)} />
              </DetailRow>
              <DetailRow label="Duration">
                <span className="font-mono">{formatTime(detail.duration_seconds)}</span>
              </DetailRow>
              <DetailRow label="Size">{formatStorage(detail.size_mb)}</DetailRow>
              <DetailRow label="Added">{formatDateTime(detail.created_at)}</DetailRow>
              <DetailRow label="Last opened">{formatRelative(detail.last_accessed)}</DetailRow>
              <DetailRow label="ID">
                <span className="font-mono text-cap" title={detail.id}>
                  {detail.id.slice(0, 8)}
                  {detail.id.length > 8 ? '…' : ''}
                </span>
              </DetailRow>
            </dl>
          </div>
        )}
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => void confirmDelete()}
        danger
        loading={deleting}
        title="Take this lecture off the shelf?"
        body={
          confirmTarget
            ? `“${confirmTarget.title}” will be removed along with its transcript, index, and media. This can’t be undone.`
            : undefined
        }
        confirmLabel="Delete lecture"
      />
    </div>
  );
}

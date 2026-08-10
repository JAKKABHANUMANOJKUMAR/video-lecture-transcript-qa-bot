import { useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  Link2,
  MessageSquareText,
  ArrowRight,
  Video as VideoIcon,
  Clock3,
  Sparkles,
} from 'lucide-react';
import { api, formatRelative, type ApiVideo } from '../lib/api';
import { cx } from '../lib/cx';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  StatusBadge,
  Tag,
  formatTime,
  useToast,
} from '../components/ui';
import { LektaLogo } from '../components/LektaLogo';
import { isYouTubeOrDriveUrl, type ChatSession, type SessionIntent } from '../components/session/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Decorative mini waveform strip for lecture cards. */
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

/**
 * The Desk — Lekta's home. Greets you, lets you drop a lecture anywhere,
 * and puts your unfinished studying one click away.
 */
export function Desk({
  userName,
  sessions,
  onResume,
  onStart,
  onGoLibrary,
  onGoSessions,
}: {
  userName: string;
  sessions: ChatSession[];
  onResume: (id: string) => void;
  onStart: (intent: SessionIntent | null) => void;
  onGoLibrary: () => void;
  onGoSessions: () => void;
}) {
  const [videos, setVideos] = useState<ApiVideo[] | null>(null);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isSupportedMediaFile = (file: File) => {
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return [
      'mp4',
      'mov',
      'webm',
      'mkv',
      'avi',
      'mp3',
      'wav',
      'm4a',
      'aac',
      'flac',
      'ogg',
    ].includes(ext ?? '');
  };

  useEffect(() => {
    api
      .listVideos()
      .then(setVideos)
      .catch(() => setVideos([]));
  }, []);

  // Drop-anywhere: the whole desk is a dropzone.
  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const leave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      if (isSupportedMediaFile(f)) {
        onStart({ file: f });
      } else {
        toast('warn', 'Invalid format', 'Please drop a video or audio file.');
      }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [onStart]);

  const submitLink = () => {
    const url = link.trim();
    if (!url) return;
    if (!isYouTubeOrDriveUrl(url)) {
      setLinkError('That link is not a YouTube or Google Drive URL.');
      return;
    }
    onStart({ url });
  };

  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3),
    [sessions],
  );
  const readyVideos = useMemo(
    () => (videos ?? []).filter((v) => v.status === 'processed').slice(0, 4),
    [videos],
  );
  const firstName = userName.split(/\s+/)[0] || 'there';
  const firstRun = sessions.length === 0 && (videos?.length ?? 0) === 0 && videos !== null;

  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Drop overlay */}
      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm animate-fade-in">
          <div className="rounded-panel border-2 border-dashed border-accent bg-accent-tint/70 px-16 py-14 text-center">
            <UploadCloud size={40} className="mx-auto text-accent" />
            <p className="mt-3 font-display text-h2 text-ink">Drop it on the desk</p>
            <p className="mt-1 text-sm text-ink-2">I’ll transcribe and index it right away.</p>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (isSupportedMediaFile(f)) {
              onStart({ file: f });
            } else {
              toast('warn', 'Invalid format', 'Please upload a video or audio file.');
            }
          }
          e.target.value = '';
        }}
      />

      {/* Greeting + intake */}
      <header className="relative overflow-hidden rounded-panel border border-line bg-surface px-6 py-10 sm:px-10">
        <div className="relative">
          <p className="text-cap font-semibold uppercase tracking-wider text-accent-deep">
            {greeting()}
          </p>
          <h1 className="mt-1 font-display text-display text-ink text-balance">
            {firstName}, what are we studying today?
          </h1>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" icon={<UploadCloud size={17} />} onClick={() => fileRef.current?.click()}>
              Upload a lecture
            </Button>
            <div className="relative flex-1 sm:max-w-md">
              <Link2
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <Input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setLinkError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitLink();
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (isYouTubeOrDriveUrl(pasted)) {
                    e.preventDefault();
                    onStart({ url: pasted.trim() });
                  }
                }}
                placeholder="…or paste a YouTube / Drive link"
                aria-label="Paste a YouTube or Google Drive link"
                className="h-12 pl-10"
              />
            </div>
            <Button variant="soft" size="lg" icon={<MessageSquareText size={16} />} onClick={() => onStart(null)}>
              Blank session
            </Button>
          </div>
          {linkError && (
            <p className="mt-2 text-cap text-danger animate-fade-in" role="alert">
              {linkError}
            </p>
          )}
          <p className="mt-3 text-cap text-ink-3">
            Or just drag a video anywhere on this page. About a minute per 10 minutes of lecture.
          </p>
        </div>
      </header>

      {firstRun && (
        <EmptyState
          className="mt-6"
          icon={<Sparkles size={26} />}
          tone="butter"
          title="Your study starts with one lecture"
          body="Upload a recording or paste a link above — then ask it anything: summaries, notes, exam questions, the exact minute a topic starts."
        />
      )}

      {/* Continue studying */}
      {recentSessions.length > 0 && (
        <section className="mt-8" aria-label="Continue studying">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-h3 text-ink">Continue studying</h2>
            <Button variant="ghost" size="sm" onClick={onGoSessions}>
              All sessions <ArrowRight size={13} />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentSessions.map((s) => {
              const last = s.messages[s.messages.length - 1];
              return (
                <Card
                  key={s.id}
                  interactive
                  onClick={() => onResume(s.id)}
                  className="p-4"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onResume(s.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-bold text-ink">{s.title}</p>
                    <span className="shrink-0 text-cap text-ink-3">{formatRelative(new Date(s.updatedAt).toISOString())}</span>
                  </div>
                  {last && (
                    <p className="mt-1.5 line-clamp-2 text-cap leading-relaxed text-ink-2">
                      {last.content}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    {s.videoName ? (
                      <Tag tone="peach" icon={<VideoIcon size={11} />} className="max-w-[70%]">
                        <span className="truncate">{s.videoName}</span>
                      </Tag>
                    ) : (
                      <Tag tone="neutral">No lecture</Tag>
                    )}
                    <span className="text-cap font-semibold text-accent-deep">Resume →</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Lecture shelf strip */}
      <section className="mt-8" aria-label="Your lectures">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 text-ink">On the shelf</h2>
          <Button variant="ghost" size="sm" onClick={onGoLibrary}>
            Open library <ArrowRight size={13} />
          </Button>
        </div>
        {videos === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-card" />
            ))}
          </div>
        ) : readyVideos.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-ink-2">
              Processed lectures land here, ready to be asked about.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {readyVideos.map((v) => (
              <Card
                key={v.id}
                interactive
                className="p-4"
                role="button"
                tabIndex={0}
                onClick={() => {
                  api.markVideoAccessed(v.id).catch(() => {});
                  onStart({ lecture: { id: v.id, title: v.title } });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    api.markVideoAccessed(v.id).catch(() => {});
                    onStart({ lecture: { id: v.id, title: v.title } });
                  }
                }}
              >
                <WaveStrip seed={v.id} />
                <p className="mt-2 line-clamp-1 text-sm font-bold text-ink" title={v.title}>
                  {v.title}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <Tag tone="neutral" icon={<Clock3 size={11} />}>
                    {formatTime(v.duration_seconds)}
                  </Tag>
                  <StatusBadge status={v.status} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 flex items-center justify-center gap-2 pb-4 text-cap text-ink-3">
        <LektaLogo size={16} variant="ink" /> Lekta · ask your lectures anything
      </footer>
    </div>
  );
}

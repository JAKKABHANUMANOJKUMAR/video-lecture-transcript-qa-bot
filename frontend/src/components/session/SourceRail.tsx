import React, { useEffect, useMemo, useState } from 'react';
import {
  Video as VideoIcon,
  FileText,
  Download,
  Search as SearchIcon,
  Clock3,
  Languages,
  Boxes,
  Play,
} from 'lucide-react';
import { cx } from '../../lib/cx';
import { rag, type TranscriptDetail } from '../../lib/rag';
import { Skeleton, Tag, Tabs, formatTime } from '../ui';
import type { TranscriptInfo } from './types';

function highlight(text: string, needle: string): React.ReactNode {
  if (!needle.trim()) return text;
  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((p, i) =>
    p.toLowerCase() === needle.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-butter-tint px-0.5 text-ink">
        {p}
      </mark>
    ) : (
      p
    ),
  );
}

/**
 * The Source rail: the lecture itself, always in reach. Video on top, lecture
 * facts, then the searchable transcript.
 */
export function SourceRail({
  videoUrl,
  videoName,
  transcript,
  transcriptId,
  videoRef,
  seekMark,
}: {
  videoUrl: string | null;
  videoName: string;
  transcript: TranscriptInfo | null;
  transcriptId: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  /** The last citation jump: `n` increments per click, `seconds` is the target. */
  seekMark: { seconds: number; n: number };
}) {
  const [tab, setTab] = useState<'video' | 'transcript'>('video');
  const [detail, setDetail] = useState<TranscriptDetail | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [q, setQ] = useState('');

  // A citation jump is about the video — surface the player even if the reader
  // was in the transcript tab, or the seek happens where nobody can see it.
  useEffect(() => {
    if (seekMark.n > 0) setTab('video');
  }, [seekMark.n]);

  useEffect(() => setMediaError(false), [videoUrl]);

  // Lazy-load transcript text the first time the tab opens.
  useEffect(() => {
    if (tab !== 'transcript' || detail || !transcriptId || loadingText) return;
    setLoadingText(true);
    setTextError('');
    rag
      .getTranscript(transcriptId)
      .then(setDetail)
      .catch((e) => setTextError(e instanceof Error ? e.message : 'Could not load the transcript.'))
      .finally(() => setLoadingText(false));
  }, [tab, detail, transcriptId, loadingText]);

  // Reset cached text when the lecture changes.
  useEffect(() => {
    setDetail(null);
    setTextError('');
    setQ('');
  }, [transcriptId]);

  const paragraphs = useMemo(() => {
    const text = detail ? detail.english_text || detail.original_text : '';
    return text
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .reduce<string[]>((acc, sentence) => {
        // Group sentences into readable ~360-char paragraphs.
        const last = acc[acc.length - 1];
        if (last !== undefined && last.length + sentence.length < 360) {
          acc[acc.length - 1] = `${last} ${sentence}`;
        } else {
          acc.push(sentence);
        }
        return acc;
      }, []);
  }, [detail]);

  const matches = q.trim()
    ? paragraphs.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase())).length
    : null;

  const download = () => {
    if (!detail) return;
    const text = detail.english_text || detail.original_text;
    if (!text.trim()) {
      setTextError('This transcript has no text to download.');
      return;
    }
    const name = (detail.title || 'transcript').replace(/[^\w\d-]+/g, '_').slice(0, 60);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3" aria-label="Lecture source">
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          {
            value: 'video',
            label: (
              <span className="flex items-center gap-1.5">
                <VideoIcon size={13} /> Video
              </span>
            ),
          },
          {
            value: 'transcript',
            label: (
              <span className="flex items-center gap-1.5">
                <FileText size={13} /> Transcript
              </span>
            ),
          },
        ]}
        className="self-start"
      />

      {/* Video stays mounted so seeks work from either tab. */}
      <div className={cx('space-y-3', tab !== 'video' && 'hidden')}>
        {/* The <video> must never sit under a keyed or animated ancestor: a
            remount would reload the source and undo the seek. The jump
            acknowledgement is therefore a sibling overlay. */}
        <div className="relative overflow-hidden rounded-image border border-line bg-ink">
          {videoUrl && !mediaError ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              onError={() => setMediaError(true)}
              className="aspect-video w-full"
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-canvas-deep px-4 text-center text-ink-3">
              <VideoIcon size={22} />
              <p className="text-cap">
                {mediaError
                  ? 'The stored video for this lecture is unavailable — citations still point at the transcript.'
                  : 'No video preview for this lecture'}
              </p>
            </div>
          )}
          {seekMark.n > 0 && videoUrl && !mediaError && (
            <div
              key={seekMark.n}
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-seek-pulse ring-2 ring-inset ring-accent"
            >
              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-chip bg-ink/85 px-2 py-1 font-mono text-[12px] font-medium text-white">
                <Play size={10} className="fill-current" />
                {formatTime(seekMark.seconds)}
              </span>
            </div>
          )}
        </div>
        <div className="rounded-card border border-line bg-surface p-4 shadow-sm">
          <p className="truncate text-sm font-bold text-ink" title={videoName}>
            {videoName || 'Untitled lecture'}
          </p>
          {transcript ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Tag tone="sky" icon={<Languages size={11} />}>
                {transcript.language.toUpperCase()}
              </Tag>
              <Tag tone="peach" icon={<Clock3 size={11} />}>
                {formatTime(transcript.durationSeconds)}
              </Tag>
              <Tag tone="mint" icon={<Boxes size={11} />}>
                {transcript.numChunks} sections indexed
              </Tag>
            </div>
          ) : (
            <p className="mt-1.5 text-cap text-ink-3">
              Lecture facts appear once it’s transcribed.
            </p>
          )}
        </div>
      </div>

      {tab === 'transcript' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          {!transcriptId ? (
            <div className="rounded-card border border-line bg-surface p-5 text-center shadow-sm">
              <p className="text-sm text-ink-2">
                The transcript appears here after the lecture is processed.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <SearchIcon
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
                  />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search the transcript…"
                    aria-label="Search the transcript"
                    className="h-9 w-full rounded-input border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 transition-all duration-micro focus:border-accent-soft focus:shadow-ring focus:outline-none"
                  />
                </div>
                <button
                  onClick={download}
                  disabled={!detail}
                  aria-label="Download transcript"
                  className="flex h-9 w-9 items-center justify-center rounded-ctl border border-line bg-surface text-ink-2 shadow-sm transition-all duration-micro hover:text-ink disabled:opacity-45"
                >
                  <Download size={15} />
                </button>
              </div>
              {matches !== null && (
                <p className="px-1 text-cap text-ink-3" aria-live="polite">
                  {matches} passage{matches === 1 ? '' : 's'} match “{q.trim()}”
                </p>
              )}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-sm">
                {loadingText && (
                  <div className="space-y-2.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-11/12" />
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3.5 w-full" />
                  </div>
                )}
                {textError && (
                  <p className="text-sm text-danger" role="alert">
                    {textError}
                  </p>
                )}
                {!loadingText &&
                  !textError &&
                  paragraphs.map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-ink-2">
                      {highlight(p, q)}
                    </p>
                  ))}
                {!loadingText && !textError && detail && paragraphs.length === 0 && (
                  <p className="text-sm text-ink-3">This transcript is empty.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

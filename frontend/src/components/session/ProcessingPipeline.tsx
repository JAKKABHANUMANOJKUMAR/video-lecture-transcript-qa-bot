import React from 'react';
import { UploadCloud, AudioLines, Boxes, Sparkles, Check } from 'lucide-react';
import { cx } from '../../lib/cx';
import { ProgressRing } from '../ui';
import type { IngestProgress } from '../../lib/rag';
import { STAGE_LABELS } from './types';

type Macro = 'upload' | 'transcribe' | 'embed' | 'ready';

const MACRO_OF_STAGE: Record<string, Macro> = {
  uploading: 'upload',
  downloading: 'upload',
  processing: 'transcribe',
  loading_model: 'transcribe',
  extracting_audio: 'transcribe',
  transcribing: 'transcribe',
  translating: 'transcribe',
  saving: 'embed',
  chunking: 'embed',
  embedding: 'embed',
  complete: 'ready',
};

const NODES: Array<{
  key: Macro;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  doneClass: string;
}> = [
  {
    key: 'upload',
    label: 'Receive',
    icon: <UploadCloud size={17} />,
    activeClass: 'bg-peach-tint text-peach-ink ring-2 ring-peach/50',
    doneClass: 'bg-peach-tint text-peach-ink',
  },
  {
    key: 'transcribe',
    label: 'Transcribe',
    icon: <AudioLines size={17} />,
    activeClass: 'bg-butter-tint text-butter-ink ring-2 ring-butter/60',
    doneClass: 'bg-butter-tint text-butter-ink',
  },
  {
    key: 'embed',
    label: 'Index',
    icon: <Boxes size={17} />,
    activeClass: 'bg-sky-tint text-sky-ink ring-2 ring-sky/50',
    doneClass: 'bg-sky-tint text-sky-ink',
  },
  {
    key: 'ready',
    label: 'Ready',
    icon: <Sparkles size={17} />,
    activeClass: 'bg-mint-tint text-mint-ink ring-2 ring-mint/60',
    doneClass: 'bg-mint-tint text-mint-ink',
  },
];

/** Tiny live waveform used while the transcriber is listening. */
function Waveform({ className }: { className?: string }) {
  return (
    <span className={cx('flex h-4 items-end gap-[3px]', className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <i
          key={i}
          className="w-[3px] origin-bottom animate-wave-bar rounded-full bg-current"
          style={{ height: `${[60, 100, 75, 90, 55][i]}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  );
}

/**
 * Processing as storytelling: the lecture travels through a four-node
 * storyboard — Receive → Transcribe → Index → Ready — instead of dying in a
 * spinner. Percent + live stage message ride along.
 */
export function ProcessingPipeline({
  progress,
  videoName,
}: {
  progress: IngestProgress;
  videoName: string;
}) {
  const macro: Macro = MACRO_OF_STAGE[progress.stage] ?? 'transcribe';
  const macroIdx = NODES.findIndex((n) => n.key === macro);

  return (
    <div
      className="rounded-panel border border-line bg-surface p-6 shadow-md animate-rise"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-4">
        <ProgressRing value={progress.percent} size={52} stroke={5}>
          {Math.round(progress.percent)}%
        </ProgressRing>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{videoName}</p>
          <p className="mt-0.5 flex items-center gap-2 text-cap text-ink-2">
            {macro === 'transcribe' && <Waveform className="text-butter-ink" />}
            {STAGE_LABELS[progress.stage] ?? 'Working'} — {progress.message}
          </p>
        </div>
      </div>

      <ol className="mt-6 flex items-center">
        {NODES.map((n, i) => {
          const state = i < macroIdx ? 'done' : i === macroIdx ? 'active' : 'todo';
          return (
            <React.Fragment key={n.key}>
              {i > 0 && (
                <i
                  className={cx(
                    'h-px flex-1 transition-colors duration-panel',
                    i <= macroIdx ? 'bg-accent-soft' : 'bg-line',
                  )}
                />
              )}
              <li className="flex flex-col items-center gap-1.5 px-1">
                <span
                  className={cx(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-panel ease-study',
                    state === 'active' && cx(n.activeClass, 'scale-110 animate-pulse-soft'),
                    state === 'done' && n.doneClass,
                    state === 'todo' && 'bg-canvas-deep text-ink-3',
                  )}
                >
                  {state === 'done' ? <Check size={16} /> : n.icon}
                </span>
                <span
                  className={cx(
                    'text-micro uppercase tracking-wider',
                    state === 'todo' ? 'text-ink-3' : 'text-ink-2',
                  )}
                >
                  {n.label}
                </span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      <p className="mt-4 text-center text-cap text-ink-3">
        Roughly a minute per 10 minutes of video — feel free to keep this tab open.
      </p>
    </div>
  );
}

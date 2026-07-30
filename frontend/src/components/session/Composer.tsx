import { useRef } from 'react';
import {
  ArrowUp,
  Paperclip,
  Link2,
  NotebookPen,
  Sparkles,
  Globe,
} from 'lucide-react';
import { cx } from '../../lib/cx';
import { Switch, Tooltip } from '../ui';

/**
 * The Session composer: a floating pill with attach/link actions, quick-action
 * chips, an all-lectures scope toggle, and a send arrow.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onPickFile,
  onPasteLink,
  onChip,
  activeChip,
  typing,
  processing,
  hasTranscript,
  searchAll,
  onSearchAll,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onPickFile: (file: File) => void;
  onPasteLink: () => void;
  onChip: (chip: 'notes' | 'assistance') => void;
  activeChip: string | null;
  typing: boolean;
  processing: boolean;
  hasTranscript: boolean;
  searchAll: boolean;
  onSearchAll: (v: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = processing;
  const canSend = !typing && !processing && value.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Quick actions + scope */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          {(
            [
              { key: 'notes', label: 'Generate notes', icon: <NotebookPen size={13} /> },
              { key: 'assistance', label: 'Assistance', icon: <Sparkles size={13} /> },
            ] as const
          ).map((c) => (
            <Tooltip
              key={c.key}
              label={hasTranscript ? c.label : 'Upload or ingest a video first'}
            >
              <button
                disabled={typing || processing || !hasTranscript}
                onClick={() => onChip(c.key)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-cap font-semibold transition-all duration-micro ease-study',
                  activeChip === c.key
                    ? 'border-accent-soft bg-accent-tint text-accent-deep'
                    : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
                  'disabled:pointer-events-none disabled:opacity-45',
                )}
              >
                {c.icon}
                {c.label}
              </button>
            </Tooltip>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-cap text-ink-2">
          <Globe size={13} className={searchAll ? 'text-accent' : 'text-ink-3'} />
          Search all my lectures
          <Switch checked={searchAll} onChange={onSearchAll} label="Search across all lectures" />
        </label>
      </div>

      {/* The pill */}
      <div
        className={cx(
          'flex items-end gap-1.5 rounded-panel border border-line bg-surface p-2 shadow-md transition-all duration-micro ease-study',
          'focus-within:border-accent-soft focus-within:shadow-ring',
          disabled && 'opacity-70',
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
            e.target.value = '';
          }}
        />
        <Tooltip label="Upload a video">
          <button
            aria-label="Upload a video"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
            className="rounded-ctl p-2.5 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep hover:text-ink disabled:pointer-events-none"
          >
            <Paperclip size={18} />
          </button>
        </Tooltip>
        <Tooltip label="Paste a YouTube or Drive link">
          <button
            aria-label="Paste a YouTube or Google Drive link"
            disabled={disabled}
            onClick={onPasteLink}
            className="rounded-ctl p-2.5 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep hover:text-ink disabled:pointer-events-none"
          >
            <Link2 size={18} />
          </button>
        </Tooltip>
        <textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          rows={Math.min(4, Math.max(1, value.split('\n').length))}
          placeholder={
            processing
              ? 'Preparing the lecture…'
              : hasTranscript
                ? 'Ask anything about this lecture…'
                : 'Upload a video, then ask a question about it…'
          }
          aria-label="Ask a question"
          className="max-h-36 min-h-[40px] flex-1 resize-none self-center bg-transparent py-2 text-body text-ink placeholder:text-ink-3 focus:outline-none"
          style={{ boxShadow: 'none' }}
        />
        <button
          aria-label="Send"
          disabled={!canSend}
          onClick={onSend}
          className={cx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl border transition-all duration-micro ease-study',
            canSend
              ? 'border-ink bg-canvas text-ink hover:bg-canvas-deep active:scale-95'
              : 'border-line bg-canvas-deep text-ink-3',
          )}
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}

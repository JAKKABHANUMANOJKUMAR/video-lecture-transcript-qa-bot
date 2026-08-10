import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Pencil,
  ExternalLink,
  CornerDownLeft,
  X,
} from 'lucide-react';
import { cx } from '../../lib/cx';
import { Markdown } from '../Markdown';
import { LektaLogo } from '../LektaLogo';
import { Tag, TimestampChip, Tooltip } from '../ui';
import type { QuerySource } from '../../lib/rag';
import type { ChatMessage } from './types';

/* ------------------------------------------------------------- Sources */

function SourceRow({
  sources,
  onSeek,
}: {
  sources: QuerySource[];
  onSeek: (s: QuerySource) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag tone="mint">grounded in {sources.length} moment{sources.length > 1 ? 's' : ''}</Tag>
        {sources.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              <TimestampChip
                seconds={s.start_seconds ?? 0}
                endSeconds={s.end_seconds ?? undefined}
                onSeek={() => onSeek(s)}
              />
            {s.deep_link && (
              <a
                href={s.deep_link}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${s.lecture_title} at ${s.timestamp_label} in a new tab`}
                className="rounded-md p-1 text-ink-3 transition-colors duration-micro hover:bg-sky-tint hover:text-sky-ink"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- Typing dots */

export function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <LektaLogo size={28} className="mt-1 shrink-0" />
      <div className="rounded-card rounded-tl-md border border-line bg-surface px-4 py-3.5 shadow-sm">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <i
              key={i}
              className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-accent"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span className="sr-only" role="status" aria-live="polite">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Messages */

export function Messages({
  messages,
  typing,
  typingLabel,
  onSeekSource,
  onRegenerate,
  onSaveEdit,
}: {
  messages: ChatMessage[];
  typing: boolean;
  typingLabel: string;
  onSeekSource: (s: QuerySource) => void;
  /** Regenerate the answer with the given bot-message id. */
  onRegenerate: (botId: string) => void;
  /** Replace an editable question's text and regenerate its answer. */
  onSaveEdit: (userMsgId: string, newText: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const anyPending = messages.some((m) => m.pending);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typing]);

  const copy = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
    } catch {
      /* clipboard may be blocked; still show feedback */
    }
    setCopiedId(m.id);
    window.setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1600);
  };

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setDraft(m.query ?? m.content);
  };

  const commitEdit = () => {
    if (editingId && draft.trim()) onSaveEdit(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="group flex justify-end gap-2 animate-rise">
            {m.query !== undefined && editingId !== m.id && (
              <button
                aria-label="Edit question"
                disabled={typing}
                onClick={() => startEdit(m)}
                className="self-center rounded-md p-1.5 text-ink-3 opacity-0 transition-all duration-micro hover:bg-canvas-deep hover:text-ink group-hover:opacity-100 disabled:pointer-events-none"
              >
                <Pencil size={14} />
              </button>
            )}
            {editingId === m.id ? (
              <div className="w-full max-w-[85%] rounded-card border border-accent-soft bg-surface p-3 shadow-md">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commitEdit();
                    }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  rows={2}
                  className="w-full resize-none bg-transparent text-body text-ink focus:outline-none"
                  style={{ boxShadow: 'none' }}
                />
                <div className="mt-2 flex items-center justify-end gap-2 text-cap text-ink-3">
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-micro hover:bg-canvas-deep hover:text-ink"
                  >
                    <X size={12} /> Cancel
                  </button>
                  <button
                    onClick={commitEdit}
                    className="flex items-center gap-1 rounded-ctl border border-ink bg-canvas px-2.5 py-1 font-semibold text-ink transition-colors duration-micro hover:bg-canvas-deep"
                  >
                    <CornerDownLeft size={12} /> Update
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-[85%] rounded-card rounded-br-md bg-accent-tint px-4 py-2.5 text-body text-ink sm:max-w-[70%]">
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            )}
          </div>
        ) : (
          <div key={m.id} className="group flex items-start gap-3 animate-rise">
            <LektaLogo size={28} className="mt-1 shrink-0" />
            <div
              className={cx(
                'relative min-w-0 flex-1 rounded-card rounded-tl-md border px-4 py-3.5 shadow-sm',
                m.isError ? 'border-rose/50 bg-rose-tint' : 'border-line bg-surface',
              )}
            >
              {m.pending ? (
                <div className="space-y-2 py-1" role="status" aria-live="polite">
                  <div className="skeleton h-3.5 w-full" />
                  <div className="skeleton h-3.5 w-4/5" />
                  <div className="skeleton h-3.5 w-3/5" />
                  <p className="pt-1 text-cap text-ink-3">Regenerating…</p>
                </div>
              ) : m.isError ? (
                <div role="alert">
                  <p className="text-sm text-rose-ink">{m.content}</p>
                  <button
                    onClick={() => onRegenerate(m.id)}
                    disabled={typing}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-ctl border border-ink bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition-all duration-micro hover:bg-canvas-deep disabled:opacity-50"
                  >
                    <RefreshCw size={13} /> Try again
                  </button>
                </div>
              ) : (
                <>
                  <Markdown>{m.content}</Markdown>
                  {m.sources && <SourceRow sources={m.sources} onSeek={onSeekSource} />}
                  <div className="absolute -top-3 right-3 flex gap-1 rounded-full border border-line bg-surface p-0.5 opacity-0 shadow-sm transition-opacity duration-micro group-hover:opacity-100 group-focus-within:opacity-100">
                    <Tooltip label={copiedId === m.id ? 'Copied!' : 'Copy answer'}>
                      <button
                        aria-label="Copy answer"
                        onClick={() => void copy(m)}
                        className="rounded-full p-1.5 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep hover:text-ink"
                      >
                        {copiedId === m.id ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
                      </button>
                    </Tooltip>
                    <Tooltip label="Regenerate">
                      <button
                        aria-label="Regenerate answer"
                        disabled={typing}
                        onClick={() => onRegenerate(m.id)}
                        className="rounded-full p-1.5 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep hover:text-ink disabled:pointer-events-none disabled:opacity-40"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </Tooltip>
                  </div>
                </>
              )}
            </div>
          </div>
        ),
      )}
      {typing && !anyPending && <TypingIndicator label={typingLabel} />}
      <div ref={endRef} />
    </div>
  );
}

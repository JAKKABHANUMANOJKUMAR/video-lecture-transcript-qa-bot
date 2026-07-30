import { useMemo, useState } from 'react';
import {
  History,
  MessageSquareText,
  Plus,
  SearchX,
  Trash2,
  Video as VideoIcon,
} from 'lucide-react';
import { formatRelative } from '../lib/api';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  SearchInput,
  Tag,
} from '../components/ui';
import type { ChatSession } from '../components/session/types';

type DayGroup = 'Today' | 'Yesterday' | 'Earlier';

function dayGroup(updatedAt: number): DayGroup {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  if (updatedAt >= startOfToday) return 'Today';
  if (updatedAt >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

const GROUP_ORDER: DayGroup[] = ['Today', 'Yesterday', 'Earlier'];

function matches(session: ChatSession, needle: string): boolean {
  if (session.title.toLowerCase().includes(needle)) return true;
  if (session.videoName && session.videoName.toLowerCase().includes(needle)) return true;
  return session.messages.some((m) => m.content.toLowerCase().includes(needle));
}

/** One session row on the timeline. */
function SessionRow({
  session,
  onOpen,
  onAskDelete,
}: {
  session: ChatSession;
  onOpen: (id: string) => void;
  onAskDelete: (session: ChatSession) => void;
}) {
  const last = session.messages[session.messages.length - 1];
  const count = session.messages.length;
  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      onClick={() => onOpen(session.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(session.id);
      }}
      className="group p-4"
      aria-label={`Resume session: ${session.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-1 text-body font-bold text-ink">{session.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          <span className="font-mono text-cap text-ink-3">
            {formatRelative(new Date(session.updatedAt).toISOString())}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete session: ${session.title}`}
            className="-my-1.5 h-8 w-8 text-ink-3 hover:text-danger opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-micro sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onAskDelete(session);
            }}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
      {last && <p className="mt-1 line-clamp-2 text-cap text-ink-2">{last.content}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {session.videoName && (
          <Tag tone="peach" icon={<VideoIcon size={11} />} className="max-w-[70%]">
            <span className="truncate">{session.videoName}</span>
          </Tag>
        )}
        <Tag tone="neutral" icon={<MessageSquareText size={11} />}>
          {count} exchange{count === 1 ? '' : 's'}
        </Tag>
      </div>
    </Card>
  );
}

/**
 * Sessions — every past conversation on one quiet timeline, grouped by day,
 * searchable down to the individual message.
 */
export function Sessions({
  sessions,
  onOpen,
  onDelete,
  onNew,
}: {
  sessions: ChatSession[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<ChatSession | null>(null);

  const sorted = useMemo(() => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt), [sessions]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (needle ? sorted.filter((s) => matches(s, needle)) : sorted),
    [sorted, needle],
  );

  const groups = useMemo(() => {
    const byDay = new Map<DayGroup, ChatSession[]>();
    for (const s of filtered) {
      const g = dayGroup(s.updatedAt);
      const list = byDay.get(g);
      if (list) list.push(s);
      else byDay.set(g, [s]);
    }
    return GROUP_ORDER.filter((g) => byDay.has(g)).map((g) => ({
      label: g,
      items: byDay.get(g) as ChatSession[],
    }));
  }, [filtered]);

  const confirmDelete = () => {
    if (toDelete) onDelete(toDelete.id);
    setToDelete(null);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-h1 text-ink">Pick up where you left off</h1>
            <p className="mt-1 text-sm text-ink-2">
              {sessions.length > 0
                ? `${sessions.length} session${sessions.length === 1 ? '' : 's'}, saved and searchable — down to every answer.`
                : 'Your conversations will gather here as you study.'}
            </p>
          </div>
          <Button icon={<Plus size={16} />} onClick={onNew} className="shrink-0">
            New session
          </Button>
        </div>
        {sessions.length > 0 && (
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, lectures, or anything you asked…"
            aria-label="Search sessions"
            className="mt-5 max-w-md"
          />
        )}
      </header>

      {sessions.length === 0 ? (
        <EmptyState
          tone="sky"
          icon={<History size={26} />}
          title="Every conversation you have lives here"
          body="Ask a lecture something and the whole exchange is kept for you — come back any time to reread an answer or keep the thread going."
          action={
            <Button icon={<Plus size={16} />} onClick={onNew}>
              Start your first session
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          tone="butter"
          icon={<SearchX size={26} />}
          title={`Nothing mentions “${query.trim()}” yet`}
          body="Try a lecture name or a phrase from the conversation itself — every message you and Lekta exchanged is searchable."
          action={
            <Button variant="soft" onClick={() => setQuery('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {groups.map(({ label, items }) => (
            <section key={label} aria-label={label} className="animate-rise">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    label === 'Today' ? 'bg-accent' : 'bg-line-strong'
                  }`}
                />
                <h2 className="text-micro uppercase text-ink-3">{label}</h2>
              </div>
              <div className="ml-[3px] mt-3 space-y-3 border-l border-line pb-7 pl-5">
                {items.map((s) => (
                  <SessionRow key={s.id} session={s} onOpen={onOpen} onAskDelete={setToDelete} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this session?"
        body={
          toDelete
            ? `“${toDelete.title}” and its conversation will be removed from your history. Any lecture it referenced stays safely in your library.`
            : undefined
        }
        confirmLabel="Delete session"
        danger
      />
    </div>
  );
}

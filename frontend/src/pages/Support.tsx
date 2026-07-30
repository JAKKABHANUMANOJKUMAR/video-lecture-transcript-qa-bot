import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Paperclip, RotateCw, Send, Sparkles, X } from 'lucide-react';
import {
  api,
  formatDate,
  formatDateTime,
  titleCaseStatus,
  toApiPriority,
  type ApiComplaint,
} from '../lib/api';
import { cx } from '../lib/cx';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Input,
  SearchInput,
  Select,
  Skeleton,
  Tabs,
  Tag,
  Textarea,
  useToast,
  type Tone,
} from '../components/ui';

/* v1 contract §5: the exact category list the backend expects. */
const CATEGORIES = [
  'Video Upload Issue',
  'Transcript Issue',
  'Chatbot Response Issue',
  'Account Issue',
  'Technical Problem',
  'Other',
] as const;

type Priority = 'Low' | 'Medium' | 'High';

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
];

function priorityTone(priority: string): Tone {
  const p = priority.toLowerCase();
  if (p === 'high') return 'rose';
  if (p === 'medium') return 'butter';
  return 'neutral';
}

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === 'resolved') return 'mint';
  if (s === 'in_progress') return 'butter';
  if (s === 'open') return 'sky';
  return 'neutral';
}

/** StatusBadge-style pill for the complaint lifecycle (open / in_progress / resolved). */
function StatusTag({ status, className }: { status: string; className?: string }) {
  const inProgress = status.toLowerCase() === 'in_progress';
  return (
    <Tag tone={statusTone(status)} className={className}>
      <i className={cx('h-1.5 w-1.5 rounded-full bg-current', inProgress && 'animate-pulse-soft')} />
      {titleCaseStatus(status)}
    </Tag>
  );
}

/**
 * Support — raise a complaint on the left, follow every ticket on the right.
 * Wraps the v1 UserComplaints contract: GET /complaints on load,
 * POST /complaints on submit (new ticket prepended).
 */
export function Support() {
  const { toast } = useToast();

  /* -------------------------------------------------------------- history */
  const [complaints, setComplaints] = useState<ApiComplaint[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<ApiComplaint | null>(null);

  const load = useCallback(() => {
    setLoadError('');
    setComplaints(null);
    api
      .listComplaints()
      .then(setComplaints)
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : 'Something went wrong while fetching your tickets.',
        ),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const list = complaints ?? [];
    const by = (s: string) => list.filter((c) => c.status.toLowerCase() === s).length;
    return {
      total: list.length,
      open: by('open'),
      inProgress: by('in_progress'),
      resolved: by('resolved'),
    };
  }, [complaints]);

  const filtered = useMemo(() => {
    const list = complaints ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.ticket_id.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
    );
  }, [complaints, query]);

  /* ----------------------------------------------------------------- form */
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [priority, setPriority] = useState<Priority>('Medium');
  const [description, setDescription] = useState('');
  const [screenshotName, setScreenshotName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; description?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const errors: { title?: string; description?: string } = {};
    if (!title.trim()) errors.title = 'A short title helps us route the ticket.';
    if (!description.trim()) errors.description = 'Tell us what happened — a sentence or two is plenty.';
    setFieldErrors(errors);
    if (errors.title || errors.description) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await api.createComplaint({
        title: title.trim(),
        category,
        priority: toApiPriority(priority),
        description: description.trim(),
        // v1 behavior kept knowingly: only the file NAME travels, never the bytes.
        screenshot_url: screenshotName || null,
      });
      setComplaints((prev) => (prev ? [created, ...prev] : [created]));
      toast(
        'ok',
        `Ticket ${created.ticket_id} raised`,
        'We usually reply within a day — follow it in your history here.',
      );
      setTitle('');
      setCategory(CATEGORIES[0]);
      setPriority('Medium');
      setDescription('');
      setScreenshotName('');
      setFieldErrors({});
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "That didn't go through — mind trying again?",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* --------------------------------------------------------------- render */

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <p className="text-cap font-semibold uppercase tracking-wider text-accent-deep">Support</p>
        <h1 className="mt-1 font-display text-h1 text-ink">How can we help?</h1>
        <p className="mt-1 text-sm text-ink-2">
          Something off with an upload, a transcript, or an answer? Raise a ticket — we read every
          one.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* ------------------------------------------------ raise a ticket */}
        <div className="lg:col-span-5">
          <Card className="p-5 sm:p-6 lg:sticky lg:top-6">
            <h2 className="text-h3 text-ink">Raise a ticket</h2>
            <p className="mt-1 text-cap text-ink-3">
              The more specific, the faster we can put it right.
            </p>

            <form onSubmit={submit} noValidate className="mt-5 space-y-4">
              <Field label="Title" htmlFor="sup-title" error={fieldErrors.title}>
                <Input
                  id="sup-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) setFieldErrors((f) => ({ ...f, title: undefined }));
                  }}
                  placeholder="e.g. Transcript stops halfway through"
                  maxLength={120}
                />
              </Field>

              <Field label="Category" htmlFor="sup-category">
                <Select
                  id="sup-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Priority" hint="High means it's blocking your studying right now.">
                <Tabs value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
              </Field>

              <Field label="What happened?" htmlFor="sup-desc" error={fieldErrors.description}>
                <Textarea
                  id="sup-desc"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (fieldErrors.description)
                      setFieldErrors((f) => ({ ...f, description: undefined }));
                  }}
                  placeholder="Walk us through it — what you did, what you expected, what you saw instead."
                  rows={5}
                />
              </Field>

              <Field
                label="Screenshot (optional)"
                hint="Honest note: only the file's name is recorded for now — image upload is coming soon."
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setScreenshotName(f.name);
                    e.target.value = '';
                  }}
                />
                {screenshotName ? (
                  <div className="flex items-center gap-1.5">
                    <Tag tone="sky" icon={<Paperclip size={11} />} className="max-w-[85%]">
                      <span className="truncate">{screenshotName}</span>
                    </Tag>
                    <button
                      type="button"
                      aria-label="Remove screenshot"
                      onClick={() => setScreenshotName('')}
                      className="rounded-md p-1 text-ink-3 transition-colors duration-micro hover:bg-canvas-deep hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Paperclip size={13} />}
                    onClick={() => fileRef.current?.click()}
                  >
                    Attach a screenshot name (upload coming soon)
                  </Button>
                )}
              </Field>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-ctl border border-rose/50 bg-rose-tint px-3.5 py-2.5 text-sm text-rose-ink animate-fade-in"
                >
                  {submitError}
                </div>
              )}

              <Button
                type="submit"
                loading={submitting}
                icon={<Send size={15} />}
                className="w-full"
              >
                {submitting ? 'Sending…' : 'Raise the ticket'}
              </Button>
            </form>
          </Card>
        </div>

        {/* --------------------------------------------------- ticket history */}
        <section className="lg:col-span-7" aria-label="Your support tickets">
          {complaints === null && !loadError ? (
            /* Loading — skeletons shaped like the loaded column. */
            <div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-6 w-52 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-11 w-full rounded-input" />
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[104px] rounded-card" />
                ))}
              </div>
            </div>
          ) : complaints === null ? (
            /* Load failure — readable message + retry. */
            <Card className="p-8 text-center" role="alert">
              <p className="text-body font-semibold text-ink">
                Your tickets couldn&rsquo;t be reached.
              </p>
              <p className="mt-1 text-sm text-ink-2">{loadError}</p>
              <div className="mt-5 flex justify-center">
                <Button variant="secondary" icon={<RotateCw size={14} />} onClick={load}>
                  Try again
                </Button>
              </div>
            </Card>
          ) : complaints.length === 0 ? (
            <Card>
              <EmptyState
                tone="mint"
                icon={<Sparkles size={28} />}
                title="No complaints — smooth studying so far."
                body="If anything ever trips you up — an upload, a transcript, an odd answer — raise a ticket here and we'll look into it."
              />
            </Card>
          ) : (
            <div className="animate-fade-in">
              {/* Stat chips */}
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-1 text-h3 text-ink">Your tickets</h2>
                <Tag tone="neutral">{stats.total} total</Tag>
                <Tag tone="sky">{stats.open} open</Tag>
                <Tag tone="butter">{stats.inProgress} in progress</Tag>
                <Tag tone="mint">{stats.resolved} resolved</Tag>
              </div>

              <SearchInput
                className="mt-3"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ticket id, title, or category…"
                aria-label="Search your tickets"
              />

              {filtered.length === 0 ? (
                <Card className="mt-4 p-6 text-center">
                  <p className="text-sm text-ink-2">
                    Nothing matches &ldquo;{query.trim()}&rdquo; — try the ticket id, a word from
                    the title, or a category.
                  </p>
                </Card>
              ) : (
                <div className="mt-4 space-y-3">
                  {filtered.map((c) => (
                    <Card
                      key={c.id}
                      interactive
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetail(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setDetail(c);
                      }}
                      className="p-4"
                      aria-label={`Open ticket ${c.ticket_id}: ${c.title}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-cap text-ink-3">{c.ticket_id}</span>
                        <span className="shrink-0 font-mono text-cap text-ink-3">
                          {formatDate(c.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-body font-bold text-ink">{c.title}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Tag tone="accent">{c.category}</Tag>
                        <Tag tone={priorityTone(c.priority)}>
                          {titleCaseStatus(c.priority)} priority
                        </Tag>
                        <StatusTag status={c.status} />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* --------------------------------------------------- details dialog */}
      {detail && (
        <Dialog
          open
          onClose={() => setDetail(null)}
          title={detail.title}
          width="max-w-lg"
          footer={
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-cap text-ink-3">{detail.ticket_id}</span>
              <Tag tone="accent">{detail.category}</Tag>
              <Tag tone={priorityTone(detail.priority)}>
                {titleCaseStatus(detail.priority)} priority
              </Tag>
              <StatusTag status={detail.status} />
            </div>

            <p className="font-mono text-cap text-ink-3">
              Submitted {formatDateTime(detail.created_at)}
            </p>

            <div>
              <p className="text-micro uppercase text-ink-3">Description</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-2">{detail.description}</p>
            </div>

            <div className="rounded-ctl bg-canvas px-3.5 py-3">
              <p className="text-micro uppercase text-ink-3">Reply from the team</p>
              {detail.admin_response ? (
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-2">
                  {detail.admin_response}
                </p>
              ) : (
                <p className="mt-1.5 text-sm italic text-ink-3">
                  Our team hasn&rsquo;t replied yet — we usually respond within a day.
                </p>
              )}
            </div>

            {detail.resolved_at && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-mint-ink">
                <CheckCircle2 size={15} />
                Resolved on {formatDate(detail.resolved_at)}
              </p>
            )}

            {detail.screenshot_url && (
              <div className="flex items-center gap-2">
                <Tag tone="sky" icon={<Paperclip size={11} />} className="max-w-full">
                  <span className="truncate">{detail.screenshot_url}</span>
                </Tag>
                <span className="text-cap text-ink-3">name only — no image attached</span>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

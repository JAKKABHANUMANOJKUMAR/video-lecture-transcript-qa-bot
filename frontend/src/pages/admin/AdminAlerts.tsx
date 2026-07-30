import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Inbox,
  Mail,
  MailOpen,
  PlayCircle,
  RotateCw,
  SearchX,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  api,
  formatDateTime,
  formatRelative,
  titleCaseStatus,
  type ApiAlert,
  type ApiComplaint,
} from '../../lib/api';
import { cx } from '../../lib/cx';
import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  SearchInput,
  Skeleton,
  Tabs,
  Tag,
  Textarea,
  useToast,
  type Tone,
} from '../../components/ui';
import {
  AdminHeader,
  CountTag,
  LoadFailure,
  StatCard,
  alertTypeTone,
  lifecycleTone,
  priorityTone,
} from './parts';

type Lane = 'alerts' | 'tickets';
type StatusKey = 'all' | 'open' | 'in_progress' | 'resolved';

const LANES: Array<{ value: Lane; label: string }> = [
  { value: 'alerts', label: 'Alerts' },
  { value: 'tickets', label: 'Support tickets' },
];

const STATUS_FILTERS: { key: StatusKey; label: string; tone: Tone }[] = [
  { key: 'all', label: 'Everything', tone: 'accent' },
  { key: 'open', label: 'Open', tone: 'sky' },
  { key: 'in_progress', label: 'In progress', tone: 'butter' },
  { key: 'resolved', label: 'Resolved', tone: 'mint' },
];

/** Dotted lifecycle pill — pulses while something is mid-flight. */
function LifecycleTag({ status }: { status: string }) {
  const inProgress = status.toLowerCase() === 'in_progress';
  return (
    <Tag tone={lifecycleTone(status)}>
      <i className={cx('h-1.5 w-1.5 rounded-full bg-current', inProgress && 'animate-pulse-soft')} />
      {titleCaseStatus(status)}
    </Tag>
  );
}

function countBy<T extends { status: string }>(items: T[], key: StatusKey): number {
  if (key === 'all') return items.length;
  return items.filter((i) => i.status.toLowerCase() === key).length;
}

/**
 * The inbox of the control room. Two lanes over one layout: system alerts on
 * the left tab, the support tickets people raised on the right. Both share the
 * open → in progress → resolved lifecycle, so both share the same controls.
 */
export function AdminAlerts() {
  const { toast } = useToast();

  const [lane, setLane] = useState<Lane>('alerts');
  const [alerts, setAlerts] = useState<ApiAlert[] | null>(null);
  const [tickets, setTickets] = useState<ApiComplaint[] | null>(null);
  const [error, setError] = useState('');

  const [status, setStatus] = useState<StatusKey>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [openAlert, setOpenAlert] = useState<ApiAlert | null>(null);
  const [notes, setNotes] = useState('');
  const [openTicket, setOpenTicket] = useState<ApiComplaint | null>(null);
  const [reply, setReply] = useState('');
  const [toDelete, setToDelete] = useState<ApiAlert | null>(null);

  const load = useCallback(() => {
    setError('');
    setAlerts(null);
    setTickets(null);
    Promise.all([api.listAlerts(), api.listComplaints()])
      .then(([a, c]) => {
        setAlerts(a);
        setTickets(c);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not open the inbox.'),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Switching lanes resets the filters — they mean different things per lane.
  useEffect(() => {
    setStatus('all');
    setQuery('');
  }, [lane]);

  /* ------------------------------------------------------------- derived */

  const alertList = alerts ?? [];
  const ticketList = tickets ?? [];
  const active: Array<ApiAlert | ApiComplaint> = lane === 'alerts' ? alertList : ticketList;

  const counts = useMemo(
    () => ({
      all: active.length,
      open: countBy(active, 'open'),
      in_progress: countBy(active, 'in_progress'),
      resolved: countBy(active, 'resolved'),
    }),
    [active],
  );

  const needle = query.trim().toLowerCase();

  const visibleAlerts = useMemo(() => {
    let out = alertList;
    if (status !== 'all') out = out.filter((a) => a.status.toLowerCase() === status);
    if (needle) {
      out = out.filter(
        (a) =>
          a.message.toLowerCase().includes(needle) ||
          a.alert_code.toLowerCase().includes(needle) ||
          (a.user_name ?? '').toLowerCase().includes(needle),
      );
    }
    return out;
  }, [alertList, status, needle]);

  const visibleTickets = useMemo(() => {
    let out = ticketList;
    if (status !== 'all') out = out.filter((t) => t.status.toLowerCase() === status);
    if (needle) {
      out = out.filter(
        (t) =>
          t.title.toLowerCase().includes(needle) ||
          t.ticket_id.toLowerCase().includes(needle) ||
          t.category.toLowerCase().includes(needle),
      );
    }
    return out;
  }, [ticketList, status, needle]);

  const unread = alertList.filter((a) => !a.is_read).length;

  /* ------------------------------------------------------------- actions */

  const patchAlert = async (
    alert: ApiAlert,
    body: { status?: string; admin_notes?: string; is_read?: boolean },
    message?: [string, string],
  ) => {
    if (busyId) return;
    setBusyId(alert.id);
    try {
      const updated = await api.updateAlert(alert.id, body);
      setAlerts((prev) => (prev ? prev.map((a) => (a.id === alert.id ? updated : a)) : prev));
      setOpenAlert((cur) => (cur?.id === alert.id ? updated : cur));
      if (message) toast('ok', message[0], message[1]);
    } catch (err) {
      toast(
        'danger',
        "That didn't save",
        err instanceof Error ? err.message : 'Please try again in a moment.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const patchTicket = async (
    ticket: ApiComplaint,
    body: { status?: string; admin_response?: string },
    message?: [string, string],
  ) => {
    if (busyId) return;
    setBusyId(ticket.id);
    try {
      const updated = await api.updateComplaint(ticket.id, body);
      setTickets((prev) => (prev ? prev.map((t) => (t.id === ticket.id ? updated : t)) : prev));
      setOpenTicket((cur) => (cur?.id === ticket.id ? updated : cur));
      if (message) toast('ok', message[0], message[1]);
    } catch (err) {
      toast(
        'danger',
        "That didn't save",
        err instanceof Error ? err.message : 'Please try again in a moment.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmDeleteAlert = async () => {
    const target = toDelete;
    if (!target || busyId) return;
    setBusyId(target.id);
    try {
      await api.deleteAlert(target.id);
      setAlerts((prev) => (prev ? prev.filter((a) => a.id !== target.id) : prev));
      setOpenAlert((cur) => (cur?.id === target.id ? null : cur));
      setToDelete(null);
      toast('ok', 'Alert dismissed', `${target.alert_code} is off the board.`);
    } catch (err) {
      setToDelete(null);
      toast(
        'danger',
        "Couldn't dismiss that alert",
        err instanceof Error ? err.message : 'Please try again in a moment.',
      );
    } finally {
      setBusyId(null);
    }
  };

  /** Opening an alert marks it read — the same gesture email has taught everyone. */
  const readAlert = (a: ApiAlert) => {
    setOpenAlert(a);
    setNotes(a.admin_notes ?? '');
    if (!a.is_read) void patchAlert(a, { is_read: true });
  };

  const readTicket = (t: ApiComplaint) => {
    setOpenTicket(t);
    setReply(t.admin_response ?? '');
  };

  /* -------------------------------------------------------------- render */

  const header = (
    <AdminHeader
      eyebrow="Inbox"
      title="Alerts & support tickets"
      subtitle="Everything the platform and its people have flagged for you."
      actions={
        <Button variant="secondary" icon={<RotateCw size={14} />} onClick={load}>
          Refresh
        </Button>
      }
    />
  );

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        {header}
        <div className="mt-6">
          <LoadFailure what="The inbox couldn't be reached." message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  if (alerts === null || tickets === null) {
    return (
      <div className="mx-auto max-w-5xl">
        {header}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-card" />
          ))}
        </div>
        <Skeleton className="mt-6 h-10 w-64 rounded-full" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-8">
      {header}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Inbox summary">
        <StatCard
          icon={<BellRing size={18} />}
          label="Open alerts"
          value={countBy(alertList, 'open')}
          tone={countBy(alertList, 'open') > 0 ? 'rose' : 'mint'}
        />
        <StatCard icon={<Mail size={18} />} label="Unread alerts" value={unread} tone="butter" />
        <StatCard
          icon={<Inbox size={18} />}
          label="Open tickets"
          value={countBy(ticketList, 'open')}
          tone="sky"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Resolved tickets"
          value={countBy(ticketList, 'resolved')}
          tone="mint"
        />
      </section>

      <div className="mt-6">
        <Tabs value={lane} onChange={setLane} options={LANES} />
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            lane === 'alerts'
              ? 'Search by code, message, or person…'
              : 'Search by ticket id, title, or category…'
          }
          aria-label="Search the inbox"
          className="w-full md:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <CountTag
              key={f.key}
              label={f.label}
              count={counts[f.key]}
              tone={f.tone}
              active={status === f.key}
              onClick={() => setStatus(f.key)}
            />
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------- alerts */}
      {lane === 'alerts' &&
        (alertList.length === 0 ? (
          <EmptyState
            className="mt-8"
            tone="mint"
            icon={<ShieldCheck size={28} />}
            title="Not a single alert"
            body="When a complaint comes in or the platform notices something, it lands here first."
          />
        ) : visibleAlerts.length === 0 ? (
          <EmptyState
            className="mt-8"
            tone="butter"
            icon={<SearchX size={26} />}
            title="Nothing matches"
            body="No alert has that status or those words. Try a different filter."
            action={
              <Button
                variant="soft"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                }}
              >
                Show every alert
              </Button>
            }
          />
        ) : (
          <div className="mt-5 space-y-3 animate-fade-in">
            {visibleAlerts.map((a) => (
              <Card
                key={a.id}
                interactive
                role="button"
                tabIndex={0}
                onClick={() => readAlert(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') readAlert(a);
                }}
                className={cx('p-4', !a.is_read && 'border-l-4 border-l-accent')}
                aria-label={`Open alert ${a.alert_code}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-cap text-ink-3">{a.alert_code}</span>
                    {!a.is_read && <Tag tone="accent">New</Tag>}
                  </span>
                  <span className="shrink-0 font-mono text-cap text-ink-3">
                    {formatRelative(a.created_at)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-body font-semibold text-ink">{a.message}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Tag tone={alertTypeTone(a.alert_type)}>{titleCaseStatus(a.alert_type)}</Tag>
                  <Tag tone={priorityTone(a.priority)}>{titleCaseStatus(a.priority)} priority</Tag>
                  <LifecycleTag status={a.status} />
                  {a.user_name && <Tag tone="neutral">{a.user_name}</Tag>}
                </div>
              </Card>
            ))}
          </div>
        ))}

      {/* -------------------------------------------------------- tickets */}
      {lane === 'tickets' &&
        (ticketList.length === 0 ? (
          <EmptyState
            className="mt-8"
            tone="mint"
            icon={<Inbox size={28} />}
            title="No tickets have been raised"
            body="When someone hits trouble with an upload, a transcript or an answer, their ticket appears here for you to reply to."
          />
        ) : visibleTickets.length === 0 ? (
          <EmptyState
            className="mt-8"
            tone="butter"
            icon={<SearchX size={26} />}
            title="Nothing matches"
            body="No ticket has that status or those words. Try a different filter."
            action={
              <Button
                variant="soft"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                }}
              >
                Show every ticket
              </Button>
            }
          />
        ) : (
          <div className="mt-5 space-y-3 animate-fade-in">
            {visibleTickets.map((t) => (
              <Card
                key={t.id}
                interactive
                role="button"
                tabIndex={0}
                onClick={() => readTicket(t)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') readTicket(t);
                }}
                className={cx('p-4', !t.admin_response && 'border-l-4 border-l-peach')}
                aria-label={`Open ticket ${t.ticket_id}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-cap text-ink-3">{t.ticket_id}</span>
                    {!t.admin_response && <Tag tone="peach">Awaiting reply</Tag>}
                  </span>
                  <span className="shrink-0 font-mono text-cap text-ink-3">
                    {formatRelative(t.created_at)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-body font-bold text-ink">{t.title}</p>
                <p className="mt-1 line-clamp-2 text-cap text-ink-2">{t.description}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Tag tone="accent">{t.category}</Tag>
                  <Tag tone={priorityTone(t.priority)}>{titleCaseStatus(t.priority)} priority</Tag>
                  <LifecycleTag status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        ))}

      {/* -------------------------------------------------- alert dialog */}
      <Dialog
        open={openAlert !== null}
        onClose={() => setOpenAlert(null)}
        title="Alert"
        width="max-w-lg"
        footer={
          openAlert ? (
            <>
              <Button
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={() => setToDelete(openAlert)}
              >
                Dismiss
              </Button>
              {openAlert.status !== 'in_progress' && openAlert.status !== 'resolved' && (
                <Button
                  variant="secondary"
                  icon={<PlayCircle size={14} />}
                  loading={busyId === openAlert.id}
                  onClick={() =>
                    void patchAlert(
                      openAlert,
                      { status: 'in_progress', admin_notes: notes.trim() || undefined },
                      ['Picked up', `${openAlert.alert_code} is now in progress.`],
                    )
                  }
                >
                  Start work
                </Button>
              )}
              <Button
                icon={<CheckCircle2 size={14} />}
                disabled={openAlert.status === 'resolved'}
                loading={busyId === openAlert.id}
                onClick={() =>
                  void patchAlert(
                    openAlert,
                    { status: 'resolved', admin_notes: notes.trim() || undefined },
                    ['Resolved', `${openAlert.alert_code} has been closed out.`],
                  )
                }
              >
                {openAlert.status === 'resolved' ? 'Resolved' : 'Resolve'}
              </Button>
            </>
          ) : undefined
        }
      >
        {openAlert && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-cap text-ink-3">{openAlert.alert_code}</span>
              <Tag tone={alertTypeTone(openAlert.alert_type)}>
                {titleCaseStatus(openAlert.alert_type)}
              </Tag>
              <Tag tone={priorityTone(openAlert.priority)}>
                {titleCaseStatus(openAlert.priority)} priority
              </Tag>
              <LifecycleTag status={openAlert.status} />
            </div>

            <p className="text-body text-ink">{openAlert.message}</p>

            <dl className="space-y-1.5 rounded-ctl bg-canvas px-3.5 py-3">
              <div className="flex justify-between gap-4">
                <dt className="text-cap text-ink-3">Raised</dt>
                <dd className="font-mono text-cap text-ink-2">
                  {formatDateTime(openAlert.created_at)}
                </dd>
              </div>
              {openAlert.user_name && (
                <div className="flex justify-between gap-4">
                  <dt className="text-cap text-ink-3">About</dt>
                  <dd className="text-cap text-ink-2">{openAlert.user_name}</dd>
                </div>
              )}
              {openAlert.resolved_at && (
                <div className="flex justify-between gap-4">
                  <dt className="text-cap text-ink-3">Resolved</dt>
                  <dd className="font-mono text-cap text-ink-2">
                    {formatDateTime(openAlert.resolved_at)}
                  </dd>
                </div>
              )}
            </dl>

            <Field
              label="Your notes"
              htmlFor="alert-notes"
              hint="Saved when you start work or resolve the alert."
            >
              <Textarea
                id="alert-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you find? What did you do about it?"
                rows={3}
              />
            </Field>

            <Button
              variant="ghost"
              size="sm"
              icon={openAlert.is_read ? <Mail size={13} /> : <MailOpen size={13} />}
              onClick={() =>
                void patchAlert(openAlert, { is_read: !openAlert.is_read })
              }
            >
              Mark as {openAlert.is_read ? 'unread' : 'read'}
            </Button>
          </div>
        )}
      </Dialog>

      {/* ------------------------------------------------- ticket dialog */}
      <Dialog
        open={openTicket !== null}
        onClose={() => setOpenTicket(null)}
        title={openTicket?.title ?? 'Ticket'}
        width="max-w-lg"
        footer={
          openTicket ? (
            <>
              {openTicket.status !== 'in_progress' && openTicket.status !== 'resolved' && (
                <Button
                  variant="secondary"
                  icon={<PlayCircle size={14} />}
                  loading={busyId === openTicket.id}
                  onClick={() =>
                    void patchTicket(
                      openTicket,
                      { status: 'in_progress', admin_response: reply.trim() || undefined },
                      ['Picked up', `${openTicket.ticket_id} is now in progress.`],
                    )
                  }
                >
                  Start work
                </Button>
              )}
              <Button
                icon={reply.trim() ? <Send size={14} /> : <CheckCircle2 size={14} />}
                loading={busyId === openTicket.id}
                disabled={openTicket.status === 'resolved' && !reply.trim()}
                onClick={() =>
                  void patchTicket(
                    openTicket,
                    { status: 'resolved', admin_response: reply.trim() || undefined },
                    [
                      'Ticket resolved',
                      reply.trim()
                        ? `Your reply is now on ${openTicket.ticket_id}.`
                        : `${openTicket.ticket_id} has been closed out.`,
                    ],
                  )
                }
              >
                {reply.trim() ? 'Reply & resolve' : 'Resolve'}
              </Button>
            </>
          ) : undefined
        }
      >
        {openTicket && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-cap text-ink-3">{openTicket.ticket_id}</span>
              <Tag tone="accent">{openTicket.category}</Tag>
              <Tag tone={priorityTone(openTicket.priority)}>
                {titleCaseStatus(openTicket.priority)} priority
              </Tag>
              <LifecycleTag status={openTicket.status} />
            </div>

            <p className="font-mono text-cap text-ink-3">
              Raised {formatDateTime(openTicket.created_at)}
            </p>

            <div>
              <p className="text-micro uppercase text-ink-3">What they told us</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-2">
                {openTicket.description}
              </p>
            </div>

            {openTicket.screenshot_url && (
              <p className="text-cap text-ink-3">
                Screenshot named{' '}
                <span className="font-mono text-ink-2">{openTicket.screenshot_url}</span> — the file
                itself was never uploaded.
              </p>
            )}

            <Field
              label="Your reply"
              htmlFor="ticket-reply"
              hint="They see this on their Support page."
            >
              <Textarea
                id="ticket-reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Tell them what you found and what happens next."
                rows={4}
              />
            </Field>

            {openTicket.resolved_at && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-mint-ink">
                <CheckCircle2 size={15} />
                Resolved on {formatDateTime(openTicket.resolved_at)}
              </p>
            )}
          </div>
        )}
      </Dialog>

      {/* ------------------------------------------------ dismiss an alert */}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void confirmDeleteAlert()}
        danger
        loading={busyId !== null && busyId === toDelete?.id}
        title="Dismiss this alert?"
        body={
          toDelete
            ? `${toDelete.alert_code} will be deleted for good. If it came from a support ticket, the ticket itself stays put.`
            : undefined
        }
        confirmLabel="Dismiss alert"
      />
    </div>
  );
}

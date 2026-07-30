import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Clock3,
  Flame,
  LifeBuoy,
  MessageSquareText,
  TrendingUp,
  Users as UsersIcon,
  Video as VideoIcon,
} from 'lucide-react';
import {
  api,
  formatDate,
  formatUsageMinutes,
  titleCaseStatus,
  type AnalyticsSummary,
  type ApiAlert,
  type ApiComplaint,
  type ApiUser,
} from '../../lib/api';
import { cx } from '../../lib/cx';
import {
  Avatar,
  Card,
  EmptyState,
  SkeletonText,
  Tabs,
  Tag,
  type Tone,
} from '../../components/ui';
import {
  AdminHeader,
  LoadFailure,
  MeterRow,
  StatCard,
  StatRowSkeleton,
  TONE_FILL,
  alertTypeTone,
  priorityTone,
  lifecycleTone,
} from './parts';

type Range = '4w' | '12w' | '26w';

const RANGE_OPTIONS: Array<{ value: Range; label: string }> = [
  { value: '4w', label: '4 weeks' },
  { value: '12w', label: '12 weeks' },
  { value: '26w', label: '6 months' },
];

const RANGE_WEEKS: Record<Range, number> = { '4w': 4, '12w': 12, '26w': 26 };

/** Midnight on the Monday of the week containing `d`. */
function startOfWeek(d: Date): number {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - dow);
  return copy.getTime();
}

const WEEK_MS = 7 * 86_400_000;

interface Bucket {
  start: number;
  label: string;
  value: number;
}

/** Count timestamps into the last `weeks` week-buckets, oldest first. */
function bucketByWeek(isoDates: Array<string | null>, weeks: number): Bucket[] {
  const thisWeek = startOfWeek(new Date());
  const buckets: Bucket[] = Array.from({ length: weeks }, (_, i) => {
    const start = thisWeek - (weeks - 1 - i) * WEEK_MS;
    return {
      start,
      label: new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: 0,
    };
  });
  const first = buckets[0].start;
  for (const iso of isoDates) {
    if (!iso) continue;
    const t = startOfWeek(new Date(iso));
    if (t < first) continue;
    const idx = Math.round((t - first) / WEEK_MS);
    if (idx >= 0 && idx < buckets.length) buckets[idx].value += 1;
  }
  return buckets;
}

/**
 * Vertical bars over a week axis. Deliberately plain: the numbers matter more
 * than the chrome, and the whole thing is one flexbox — no chart dependency.
 */
function TrendBars({ data, tone = 'accent' }: { data: Bucket[]; tone?: Tone }) {
  const peak = Math.max(1, ...data.map((d) => d.value));
  // Only every other label on dense ranges, so the axis stays readable.
  const step = data.length > 14 ? 4 : data.length > 7 ? 2 : 1;
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Weekly trend">
        {data.map((d) => (
          <div key={d.start} className="group relative flex flex-1 flex-col justify-end">
            <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded-chip bg-ink px-1.5 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity duration-micro group-hover:opacity-100">
              {d.value}
            </span>
            <i
              className={cx(
                'block w-full rounded-t-chip transition-all duration-panel ease-study',
                d.value === 0 ? 'bg-canvas-deep' : TONE_FILL[tone],
              )}
              style={{ height: `${Math.max(3, (d.value / peak) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-line pt-2">
        {data.map((d, i) => (
          <span key={d.start} className="flex-1 text-center font-mono text-[10px] text-ink-3">
            {i % step === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Group a list by a string key, sorted by count descending. */
function tally<T>(items: T[], key: (item: T) => string): Array<{ label: string; value: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

const USAGE_BUCKETS: Array<{ label: string; test: (m: number) => boolean; tone: Tone }> = [
  { label: 'Not started', test: (m) => m === 0, tone: 'neutral' },
  { label: 'Under 1 hour', test: (m) => m > 0 && m < 60, tone: 'sky' },
  { label: '1–5 hours', test: (m) => m >= 60 && m < 300, tone: 'accent' },
  { label: '5–20 hours', test: (m) => m >= 300 && m < 1200, tone: 'mint' },
  { label: '20 hours +', test: (m) => m >= 1200, tone: 'peach' },
];

/**
 * Analytics — how Lekta is actually being used. Every figure here is derived
 * from real rows; nothing is projected or estimated.
 */
export function AdminAnalytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [users, setUsers] = useState<ApiUser[] | null>(null);
  const [complaints, setComplaints] = useState<ApiComplaint[] | null>(null);
  const [alerts, setAlerts] = useState<ApiAlert[] | null>(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>('12w');

  const load = useCallback(() => {
    setError('');
    setSummary(null);
    setUsers(null);
    setComplaints(null);
    setAlerts(null);
    Promise.all([api.analyticsSummary(), api.listUsers(), api.listComplaints(), api.listAlerts()])
      .then(([s, u, c, a]) => {
        setSummary(s);
        setUsers(u);
        setComplaints(c);
        setAlerts(a);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not gather the numbers.'),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const weeks = RANGE_WEEKS[range];

  const signups = useMemo(
    () => bucketByWeek((users ?? []).map((u) => u.created_at), weeks),
    [users, weeks],
  );

  const tickets = useMemo(
    () => bucketByWeek((complaints ?? []).map((c) => c.created_at), weeks),
    [complaints, weeks],
  );

  const signupsInRange = signups.reduce((a, b) => a + b.value, 0);
  const ticketsInRange = tickets.reduce((a, b) => a + b.value, 0);

  const usageSpread = useMemo(() => {
    const list = users ?? [];
    return USAGE_BUCKETS.map((b) => ({
      label: b.label,
      tone: b.tone,
      value: list.filter((u) => b.test(u.usage_minutes)).length,
    }));
  }, [users]);

  const topStudiers = useMemo(
    () =>
      [...(users ?? [])]
        .filter((u) => u.usage_minutes > 0)
        .sort((a, b) => b.usage_minutes - a.usage_minutes)
        .slice(0, 5),
    [users],
  );

  const ticketsByCategory = useMemo(() => tally(complaints ?? [], (c) => c.category), [complaints]);
  const ticketsByStatus = useMemo(() => tally(complaints ?? [], (c) => c.status), [complaints]);
  const alertsByType = useMemo(() => tally(alerts ?? [], (a) => a.alert_type), [alerts]);
  const alertsByPriority = useMemo(() => tally(alerts ?? [], (a) => a.priority), [alerts]);

  const oldestAccount = useMemo(() => {
    const list = users ?? [];
    if (list.length === 0) return null;
    return list.reduce((oldest, u) =>
      new Date(u.created_at).getTime() < new Date(oldest.created_at).getTime() ? u : oldest,
    );
  }, [users]);

  /* -------------------------------------------------------------- render */

  const header = (
    <AdminHeader
      eyebrow="Analytics"
      title="How Lekta is being used"
      subtitle="Every number here is counted from real rows — nothing is projected."
    />
  );

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6">
          <LoadFailure what="The numbers couldn't be gathered." message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  if (summary === null || users === null || complaints === null || alerts === null) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6">
          <StatRowSkeleton />
        </div>
        <Card className="mt-6 p-5">
          <SkeletonText lines={8} />
        </Card>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <SkeletonText lines={5} />
          </Card>
          <Card className="p-5">
            <SkeletonText lines={5} />
          </Card>
        </div>
      </div>
    );
  }

  const noData = users.length === 0 && complaints.length === 0 && alerts.length === 0;

  return (
    <div className="mx-auto max-w-6xl pb-8">
      {header}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Headline figures">
        <StatCard
          icon={<UsersIcon size={18} />}
          label="Accounts"
          value={summary.total_users}
          tone="accent"
          hint={`${summary.active_users} active`}
        />
        <StatCard
          icon={<VideoIcon size={18} />}
          label="Lectures"
          value={summary.total_videos}
          tone="peach"
        />
        <StatCard
          icon={<MessageSquareText size={18} />}
          label="Sessions"
          value={summary.total_chats}
          tone="sky"
        />
        <StatCard
          icon={<Clock3 size={18} />}
          label="Average study time"
          value={formatUsageMinutes(Math.round(summary.avg_usage_minutes))}
          tone="mint"
        />
      </section>

      {noData ? (
        <Card className="mt-6">
          <EmptyState
            tone="sky"
            icon={<BarChart3 size={28} />}
            title="Nothing to measure yet"
            body="Once people sign up, upload lectures and raise tickets, this page fills in with the real shape of that activity."
          />
        </Card>
      ) : (
        <>
          {/* ------------------------------------------------------- trends */}
          <Card className="mt-6 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-h3 text-ink">Growth</h2>
                <p className="mt-0.5 text-cap text-ink-3">
                  New accounts per week over the selected window.
                </p>
              </div>
              <Tabs value={range} onChange={setRange} options={RANGE_OPTIONS} />
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <div className="flex items-baseline gap-2">
                  <TrendingUp size={15} className="text-accent" />
                  <p className="text-sm font-semibold text-ink">Sign-ups</p>
                  <span className="font-mono text-cap text-ink-3">
                    {signupsInRange} in this window
                  </span>
                </div>
                <div className="mt-3">
                  <TrendBars data={signups} tone="accent" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <LifeBuoy size={15} className="text-peach-ink" />
                  <p className="text-sm font-semibold text-ink">Support tickets</p>
                  <span className="font-mono text-cap text-ink-3">
                    {ticketsInRange} in this window
                  </span>
                </div>
                <div className="mt-3">
                  <TrendBars data={tickets} tone="peach" />
                </div>
              </div>
            </div>

            {oldestAccount && (
              <p className="mt-5 border-t border-line pt-4 text-cap text-ink-3">
                Lekta has been running since {formatDate(oldestAccount.created_at)} — the date of
                the first account.
              </p>
            )}
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            {/* ------------------------------------------ study engagement */}
            <Card className="p-5 lg:col-span-5">
              <h2 className="text-h3 text-ink">Study engagement</h2>
              <p className="mt-0.5 text-cap text-ink-3">
                How the {users.length} account{users.length === 1 ? '' : 's'} spread across time
                spent.
              </p>
              <div className="mt-4 space-y-3.5">
                {usageSpread.map((b) => (
                  <MeterRow
                    key={b.label}
                    label={b.label}
                    value={b.value}
                    total={users.length}
                    tone={b.tone}
                  />
                ))}
              </div>
            </Card>

            {/* ----------------------------------------------- top studiers */}
            <Card className="lg:col-span-7">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-h3 text-ink">Most time on Lekta</h2>
                <p className="mt-0.5 text-cap text-ink-3">
                  The five people who have studied the most.
                </p>
              </div>
              {topStudiers.length === 0 ? (
                <EmptyState
                  tone="butter"
                  icon={<Flame size={26} />}
                  title="No study time logged yet"
                  body="As people work through lectures, the heaviest users will show up here."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {topStudiers.map((u, i) => (
                    <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-4 shrink-0 text-center font-mono text-cap text-ink-3">
                        {i + 1}
                      </span>
                      <Avatar name={u.full_name} src={u.avatar_url} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{u.full_name}</p>
                        <p className="truncate text-cap text-ink-3">{u.email}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm text-ink">
                        {formatUsageMinutes(u.usage_minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* -------------------------------------------------- tickets */}
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-h3 text-ink">Support tickets</h2>
                <Tag tone="neutral">{complaints.length} total</Tag>
              </div>
              {complaints.length === 0 ? (
                <p className="mt-4 text-sm text-ink-2">
                  Nobody has raised a ticket yet — a good problem to have.
                </p>
              ) : (
                <>
                  <p className="mt-4 text-micro uppercase text-ink-3">By status</p>
                  <div className="mt-2.5 space-y-3">
                    {ticketsByStatus.map((s) => (
                      <MeterRow
                        key={s.label}
                        label={titleCaseStatus(s.label)}
                        value={s.value}
                        total={complaints.length}
                        tone={lifecycleTone(s.label)}
                      />
                    ))}
                  </div>
                  <p className="mt-5 text-micro uppercase text-ink-3">By category</p>
                  <div className="mt-2.5 space-y-2">
                    {ticketsByCategory.map((c) => (
                      <div key={c.label} className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm text-ink-2">{c.label}</span>
                        <span className="shrink-0 font-mono text-cap text-ink">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/* --------------------------------------------------- alerts */}
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-h3 text-ink">Alerts</h2>
                <Tag tone="neutral">{alerts.length} total</Tag>
              </div>
              {alerts.length === 0 ? (
                <p className="mt-4 text-sm text-ink-2">
                  No alerts have ever been raised on this platform.
                </p>
              ) : (
                <>
                  <p className="mt-4 text-micro uppercase text-ink-3">By priority</p>
                  <div className="mt-2.5 space-y-3">
                    {alertsByPriority.map((p) => (
                      <MeterRow
                        key={p.label}
                        label={titleCaseStatus(p.label)}
                        value={p.value}
                        total={alerts.length}
                        tone={priorityTone(p.label)}
                      />
                    ))}
                  </div>
                  <p className="mt-5 text-micro uppercase text-ink-3">By type</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {alertsByType.map((t) => (
                      <Tag key={t.label} tone={alertTypeTone(t.label)}>
                        {titleCaseStatus(t.label)}
                        <span className="opacity-60 tabular-nums">{t.value}</span>
                      </Tag>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

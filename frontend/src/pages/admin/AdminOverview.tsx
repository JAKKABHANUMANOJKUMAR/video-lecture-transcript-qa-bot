import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BellRing,
  Clock3,
  Download,
  LifeBuoy,
  MessageSquareText,
  Settings,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users as UsersIcon,
  Video as VideoIcon,
} from 'lucide-react';
import {
  api,
  formatRelative,
  formatUsageMinutes,
  type AnalyticsSummary,
  type ApiAlert,
  type ApiUser,
} from '../../lib/api';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Skeleton,
  SkeletonText,
  Tag,
} from '../../components/ui';
import {
  AdminHeader,
  CategoryBars,
  ChartSkeleton,
  LoadFailure,
  RangeSelect,
  StatCard,
  StatRowSkeleton,
  rangeDays,
  type RangeKey,
} from './parts';

type AdminView = 'overview' | 'users' | 'analytics' | 'alerts' | 'settings';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The Control Room — the admin's landing. One honest read of the platform:
 * how many people are here, what they're studying, and what needs a human.
 */
export function AdminOverview({ onNavigate }: { onNavigate: (view: AdminView) => void }) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [users, setUsers] = useState<ApiUser[] | null>(null);
  const [alerts, setAlerts] = useState<ApiAlert[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    setSummary(null);
    setUsers(null);
    setAlerts(null);
    Promise.all([api.analyticsSummary(), api.listUsers(), api.listAlerts()])
      .then(([s, u, a]) => {
        setSummary(s);
        setUsers(u);
        setAlerts(a);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not read the platform right now.'),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------------------------------------- derived */

  const openAlerts = useMemo(
    () => (alerts ?? []).filter((a) => a.status.toLowerCase() === 'open'),
    [alerts],
  );

  const newest = useMemo(
    () =>
      [...(users ?? [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [users],
  );

  const highPriority = openAlerts.filter((a) => a.priority.toLowerCase() === 'high').length;

  /* -------------------------------------------------------- chart ranges */

  // Each card owns its own window. Changing one re-queries the API with a
  // `days` param so the counts are narrowed in SQL, not in the browser.
  const [statusRange, setStatusRange] = useState<RangeKey>('all');
  const [platformRange, setPlatformRange] = useState<RangeKey>('all');
  const [statusData, setStatusData] = useState<AnalyticsSummary | null>(null);
  const [platformData, setPlatformData] = useState<AnalyticsSummary | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [platformBusy, setPlatformBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatusBusy(true);
    api
      .analyticsSummary(rangeDays(statusRange))
      .then((s) => !cancelled && setStatusData(s))
      .catch(() => !cancelled && setStatusData(null))
      .finally(() => !cancelled && setStatusBusy(false));
    return () => {
      cancelled = true;
    };
  }, [statusRange]);

  useEffect(() => {
    let cancelled = false;
    setPlatformBusy(true);
    api
      .analyticsSummary(rangeDays(platformRange))
      .then((s) => !cancelled && setPlatformData(s))
      .catch(() => !cancelled && setPlatformData(null))
      .finally(() => !cancelled && setPlatformBusy(false));
    return () => {
      cancelled = true;
    };
  }, [platformRange]);

  /** Download the figures currently on screen as a CSV. */
  const exportReport = useCallback(() => {
    if (!summary) return;
    const rows: Array<[string, string | number]> = [
      ['Metric', 'Value'],
      ['Generated', new Date().toISOString()],
      ['Total users', summary.total_users],
      ['Active users', summary.active_users],
      ['Inactive users', summary.inactive_users],
      ['Blocked users', summary.blocked_users],
      ['Total videos', summary.total_videos],
      ['Study sessions', summary.total_chats],
      ['Open alerts', summary.open_alerts],
      ['Support tickets', summary.total_complaints],
      ['Average study minutes', summary.avg_usage_minutes],
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lekta-platform-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [summary]);

  /* -------------------------------------------------------------- render */

  const header = (
    <AdminHeader
      eyebrow="Control room"
      title={`${greeting()} — here's the platform`}
      subtitle="Everything Lekta knows about itself, on one page."
      actions={
        <Button variant="secondary" onClick={() => onNavigate('analytics')}>
          Full analytics
        </Button>
      }
    />
  );

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6">
          <LoadFailure what="The control room couldn't be reached." message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  if (summary === null || users === null || alerts === null) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6">
          <StatRowSkeleton />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <ChartSkeleton />
          </Card>
          <Card className="p-5">
            <ChartSkeleton />
          </Card>
        </div>
        <Card className="mt-4 p-5">
          <Skeleton className="h-10 rounded-ctl" />
        </Card>
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <Card className="p-5 lg:col-span-7">
            <SkeletonText lines={4} />
          </Card>
          <Card className="p-5 lg:col-span-5">
            <Skeleton className="h-32 rounded-card" />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-8">
      {header}

      {/* Headline numbers — each tile is a door to the screen that explains it. */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Platform summary">
        <StatCard
          icon={<UsersIcon size={18} />}
          label="People on Lekta"
          value={summary.total_users}
          tone="accent"
          hint={`${summary.active_users} active`}
          onClick={() => onNavigate('users')}
        />
        <StatCard
          icon={<VideoIcon size={18} />}
          label="Lectures brought in"
          value={summary.total_videos}
          tone="peach"
          onClick={() => onNavigate('analytics')}
        />
        <StatCard
          icon={<MessageSquareText size={18} />}
          label="Study sessions"
          value={summary.total_chats}
          tone="sky"
          onClick={() => onNavigate('analytics')}
        />
        <StatCard
          icon={<BellRing size={18} />}
          label="Open alerts"
          value={summary.open_alerts}
          tone={summary.open_alerts > 0 ? 'rose' : 'mint'}
          hint={highPriority > 0 ? `${highPriority} high priority` : 'Nothing urgent'}
          onClick={() => onNavigate('alerts')}
        />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* ----------------------------------------------------- user status */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl bg-canvas-deep text-ink-2">
                <UsersIcon size={16} />
              </span>
              <h2 className="truncate text-h3 text-ink">User Status</h2>
            </div>
            <RangeSelect
              value={statusRange}
              onChange={setStatusRange}
              label="Range for user status"
              busy={statusBusy}
            />
          </div>

          <div className="mt-5">
            {statusData === null ? (
              <ChartSkeleton />
            ) : (
              <CategoryBars
                data={[
                  { label: 'Active', value: statusData.active_users, fill: 'bg-accent' },
                  { label: 'Inactive', value: statusData.inactive_users, fill: 'bg-mark-neutral' },
                  { label: 'Blocked', value: statusData.blocked_users, fill: 'bg-rose' },
                ]}
                caption={`${statusData.total_users} account${
                  statusData.total_users === 1 ? '' : 's'
                } ${statusRange === 'all' ? 'in total' : 'created in this window'}.`}
              />
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-ctl bg-canvas px-3.5 py-3">
            <Clock3 size={16} className="shrink-0 text-ink-3" />
            <p className="text-sm text-ink-2">
              Average study time{' '}
              <span className="font-mono font-semibold text-ink">
                {formatUsageMinutes(Math.round(summary.avg_usage_minutes))}
              </span>{' '}
              per person.
            </p>
          </div>
        </Card>

        {/* ------------------------------------------------ platform overview */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl bg-canvas-deep text-ink-2">
                <Activity size={16} />
              </span>
              <h2 className="truncate text-h3 text-ink">Platform Overview</h2>
            </div>
            <RangeSelect
              value={platformRange}
              onChange={setPlatformRange}
              label="Range for platform overview"
              busy={platformBusy}
            />
          </div>

          <div className="mt-5">
            {platformData === null ? (
              <ChartSkeleton />
            ) : (
              <CategoryBars
                data={[
                  { label: 'Users', value: platformData.total_users, fill: 'bg-accent' },
                  { label: 'Videos', value: platformData.total_videos, fill: 'bg-accent' },
                  { label: 'Chats', value: platformData.total_chats, fill: 'bg-accent' },
                  { label: 'Complaints', value: platformData.total_complaints, fill: 'bg-accent' },
                  { label: 'Alerts', value: platformData.open_alerts, fill: 'bg-accent' },
                ]}
                caption="Platform metrics — counted live from the database."
              />
            )}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------ quick actions */}
      <Card className="mt-4 p-5">
        <h2 className="text-h3 text-ink">Quick Actions</h2>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button icon={<BellRing size={15} />} onClick={() => onNavigate('alerts')}>
            Review Alerts
          </Button>
          <Button
            variant="secondary"
            icon={<TrendingUp size={15} />}
            onClick={() => onNavigate('analytics')}
          >
            View Analytics
          </Button>
          <Button
            variant="secondary"
            icon={<Activity size={15} />}
            onClick={() => onNavigate('users')}
          >
            Usage Report
          </Button>
          <Button variant="soft" icon={<Download size={15} />} onClick={exportReport}>
            Export Report
          </Button>
          <Button
            variant="secondary"
            icon={<Settings size={15} />}
            onClick={() => onNavigate('settings')}
          >
            Configure System
          </Button>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        {/* ---------------------------------------------------- new people */}
        <Card className="lg:col-span-7">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-h3 text-ink">Newest accounts</h2>
              <p className="mt-0.5 text-cap text-ink-3">The five most recent people to join.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() => onNavigate('users')}
            >
              Manage
            </Button>
          </div>

          {newest.length === 0 ? (
            <EmptyState
              tone="sky"
              icon={<UserPlus size={26} />}
              title="No accounts yet"
              body="The first person to sign up will appear here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {newest.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={u.full_name} src={u.avatar_url} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{u.full_name}</p>
                    <p className="truncate text-cap text-ink-3">{u.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {u.role === 'admin' && <Tag tone="accent">Admin</Tag>}
                    <p className="mt-0.5 text-cap text-ink-3">
                      Joined {formatRelative(u.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ------------------------------------------------------ shortcuts */}
        <Card className="p-5 lg:col-span-5">
          <h2 className="text-h3 text-ink">Jump to</h2>
          <p className="mt-0.5 text-cap text-ink-3">The rest of the control room.</p>
          <div className="mt-4 space-y-2">
            <ShortcutRow
              icon={<UsersIcon size={16} />}
              label="Manage people"
              hint="Search, block, or remove accounts"
              onClick={() => onNavigate('users')}
            />
            <ShortcutRow
              icon={<Sparkles size={16} />}
              label="Analytics"
              hint="Growth, study time, and ticket trends"
              onClick={() => onNavigate('analytics')}
            />
            <ShortcutRow
              icon={<LifeBuoy size={16} />}
              label="Alerts & tickets"
              hint={`${summary.total_complaints} ticket${summary.total_complaints === 1 ? '' : 's'} raised so far`}
              onClick={() => onNavigate('alerts')}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

/** A single navigation row inside the "Jump to" card. */
function ShortcutRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-ctl px-3 py-2.5 text-left transition-colors duration-micro hover:bg-canvas"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl bg-canvas-deep text-ink-2 transition-colors duration-micro group-hover:bg-accent-tint group-hover:text-accent-deep">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{label}</span>
        <span className="block truncate text-cap text-ink-3">{hint}</span>
      </span>
      <ArrowRight
        size={15}
        className="shrink-0 text-ink-3 transition-transform duration-micro ease-study group-hover:translate-x-0.5"
      />
    </button>
  );
}

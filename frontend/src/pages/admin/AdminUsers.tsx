import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  PauseCircle,
  RotateCw,
  SearchX,
  ShieldCheck,
  Trash2,
  UserRound,
  Users as UsersIcon,
} from 'lucide-react';
import {
  api,
  formatDate,
  formatRelative,
  formatUsageMinutes,
  titleCaseStatus,
  type ApiUser,
} from '../../lib/api';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Menu,
  MenuItem,
  MenuSeparator,
  SearchInput,
  Skeleton,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  useToast,
  type Tone,
} from '../../components/ui';
import {
  AdminHeader,
  CountTag,
  LoadFailure,
  StatCard,
  StatRowSkeleton,
  accountTone,
} from './parts';

type StatusKey = 'all' | 'active' | 'inactive' | 'blocked';

const FILTERS: { key: StatusKey; label: string; tone: Tone }[] = [
  { key: 'all', label: 'Everyone', tone: 'accent' },
  { key: 'active', label: 'Active', tone: 'mint' },
  { key: 'inactive', label: 'Inactive', tone: 'neutral' },
  { key: 'blocked', label: 'Blocked', tone: 'rose' },
];

function providerLabel(provider: string): string {
  return provider.toLowerCase() === 'local' ? 'Email & password' : titleCaseStatus(provider);
}

/**
 * People — every account on Lekta, searchable, with the three things an admin
 * actually needs: see who they are, pause or block them, remove them.
 *
 * Filtering and search are done client-side over one fetch so the table never
 * flickers while you type; the list is refetched only on demand.
 */
export function AdminUsers() {
  const { toast } = useToast();

  const [users, setUsers] = useState<ApiUser[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusKey>('all');
  const [detail, setDetail] = useState<ApiUser | null>(null);
  const [toDelete, setToDelete] = useState<ApiUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError('');
    setUsers(null);
    api
      .listUsers()
      .then(setUsers)
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : 'Could not load the accounts.'),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------------------------------------- derived */

  const list = users ?? [];

  const counts = useMemo(
    () => ({
      all: list.length,
      active: list.filter((u) => u.status === 'active').length,
      inactive: list.filter((u) => u.status === 'inactive').length,
      blocked: list.filter((u) => u.status === 'blocked').length,
    }),
    [list],
  );

  const admins = useMemo(() => list.filter((u) => u.role === 'admin').length, [list]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const searched = needle
      ? list.filter(
          (u) =>
            u.full_name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
        )
      : list;
    return filter === 'all' ? searched : searched.filter((u) => u.status === filter);
  }, [list, needle, filter]);

  /* ------------------------------------------------------------- actions */

  const setStatus = async (user: ApiUser, next: 'active' | 'inactive' | 'blocked') => {
    if (busyId) return;
    setBusyId(user.id);
    try {
      const updated = await api.setUserStatus(user.id, next);
      setUsers((prev) => (prev ? prev.map((u) => (u.id === user.id ? updated : u)) : prev));
      setDetail((d) => (d?.id === user.id ? updated : d));
      const verb =
        next === 'blocked' ? 'blocked' : next === 'inactive' ? 'paused' : 'reactivated';
      toast('ok', `${user.full_name} ${verb}`, `Their account is now ${next}.`);
    } catch (err) {
      toast(
        'danger',
        "That didn't take effect",
        err instanceof Error ? err.message : 'Please try again in a moment.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const target = toDelete;
    if (!target || busyId) return;
    setBusyId(target.id);
    try {
      await api.deleteUser(target.id);
      setUsers((prev) => (prev ? prev.filter((u) => u.id !== target.id) : prev));
      setDetail((d) => (d?.id === target.id ? null : d));
      setToDelete(null);
      toast(
        'ok',
        `${target.full_name} removed`,
        'Their sessions, lectures and tickets went with the account.',
      );
    } catch (err) {
      setToDelete(null);
      toast(
        'danger',
        "Couldn't remove that account",
        err instanceof Error ? err.message : 'Please try again in a moment.',
      );
    } finally {
      setBusyId(null);
    }
  };

  /* -------------------------------------------------------------- render */

  const header = (
    <AdminHeader
      eyebrow="People"
      title="Everyone on Lekta"
      subtitle="Who has an account, how much they study, and what they need from you."
      actions={
        <Button variant="secondary" icon={<RotateCw size={14} />} onClick={load}>
          Refresh
        </Button>
      }
    />
  );

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6">
          <LoadFailure what="The accounts couldn't be reached." message={loadError} onRetry={load} />
        </div>
      </div>
    );
  }

  if (users === null) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6">
          <StatRowSkeleton />
        </div>
        <Skeleton className="mt-6 h-11 w-full max-w-sm rounded-ctl" />
        <Card className="mt-6 p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-ctl" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-8">
      {header}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Account summary">
        <StatCard icon={<UsersIcon size={18} />} label="Accounts" value={counts.all} tone="accent" />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Active"
          value={counts.active}
          tone="mint"
        />
        <StatCard icon={<Ban size={18} />} label="Blocked" value={counts.blocked} tone="rose" />
        <StatCard icon={<ShieldCheck size={18} />} label="Admins" value={admins} tone="sky" />
      </section>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search accounts by name or email"
          className="w-full md:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <CountTag
              key={f.key}
              label={f.label}
              count={counts[f.key]}
              tone={f.tone}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          className="mt-8"
          tone="sky"
          icon={<UsersIcon size={28} />}
          title="No accounts yet"
          body="Once people sign up for Lekta they'll appear here, along with how much they've been studying."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          className="mt-8"
          tone="butter"
          icon={<SearchX size={26} />}
          title="Nobody matches that"
          body={
            needle
              ? `No name or email matches “${query.trim()}”. Try a shorter word, or clear the search.`
              : 'No accounts have this status right now. Try another filter.'
          }
          action={
            <Button
              variant="soft"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Show everyone
            </Button>
          }
        />
      ) : (
        <Card className="mt-6 animate-fade-in">
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Status</Th>
                <Th>Role</Th>
                <Th className="text-right">Study time</Th>
                <Th>Last sign-in</Th>
                <Th>Joined</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <Tr key={u.id} interactive onClick={() => setDetail(u)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} src={u.avatar_url} size={34} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{u.full_name}</p>
                        <p className="truncate text-cap text-ink-3">{u.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Tag tone={accountTone(u.status)}>{titleCaseStatus(u.status)}</Tag>
                  </Td>
                  <Td>
                    <Tag tone={u.role === 'admin' ? 'accent' : 'neutral'}>
                      {u.role === 'admin' ? 'Admin' : 'Student'}
                    </Tag>
                  </Td>
                  <Td className="text-right font-mono">{formatUsageMinutes(u.usage_minutes)}</Td>
                  <Td className="whitespace-nowrap">{formatRelative(u.last_login)}</Td>
                  <Td className="whitespace-nowrap">{formatDate(u.created_at)}</Td>
                  <Td className="text-right">
                    <div
                      className="flex justify-end"
                      onClick={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                      <Menu
                        trigger={() => (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${u.full_name}`}
                          >
                            <MoreHorizontal size={16} />
                          </Button>
                        )}
                      >
                        <MenuItem icon={<UserRound size={15} />} onClick={() => setDetail(u)}>
                          View details
                        </MenuItem>
                        <MenuSeparator />
                        {u.status !== 'active' && (
                          <MenuItem
                            icon={<CheckCircle2 size={15} />}
                            onClick={() => void setStatus(u, 'active')}
                          >
                            Reactivate
                          </MenuItem>
                        )}
                        {u.status !== 'inactive' && (
                          <MenuItem
                            icon={<PauseCircle size={15} />}
                            onClick={() => void setStatus(u, 'inactive')}
                          >
                            Mark inactive
                          </MenuItem>
                        )}
                        {u.status !== 'blocked' && (
                          <MenuItem
                            icon={<Ban size={15} />}
                            onClick={() => void setStatus(u, 'blocked')}
                          >
                            Block account
                          </MenuItem>
                        )}
                        <MenuSeparator />
                        <MenuItem danger icon={<Trash2 size={15} />} onClick={() => setToDelete(u)}>
                          Delete account
                        </MenuItem>
                      </Menu>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="border-t border-line px-4 py-3 text-cap text-ink-3">
            Showing {visible.length} of {list.length} account{list.length === 1 ? '' : 's'}.
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------ detail dialog */}
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Account details"
        width="max-w-lg"
        footer={
          detail ? (
            <>
              <Button
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={() => setToDelete(detail)}
              >
                Delete
              </Button>
              {detail.status === 'blocked' ? (
                <Button
                  icon={<CheckCircle2 size={14} />}
                  loading={busyId === detail.id}
                  onClick={() => void setStatus(detail, 'active')}
                >
                  Unblock
                </Button>
              ) : (
                <Button
                  icon={<Ban size={14} />}
                  loading={busyId === detail.id}
                  onClick={() => void setStatus(detail, 'blocked')}
                >
                  Block
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {detail && (
          <div>
            <div className="flex items-center gap-4">
              <Avatar name={detail.full_name} src={detail.avatar_url} size={56} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-h3 text-ink">{detail.full_name}</p>
                  <Tag tone={detail.role === 'admin' ? 'accent' : 'sky'}>
                    {detail.role === 'admin' ? 'Admin' : 'Student'}
                  </Tag>
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-2">{detail.email}</p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-micro uppercase text-ink-3">Status</dt>
                <dd className="mt-1">
                  <Tag tone={accountTone(detail.status)}>{titleCaseStatus(detail.status)}</Tag>
                </dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Study time</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-mono text-sm text-ink">
                  <Clock3 size={13} className="text-ink-3" />
                  {formatUsageMinutes(detail.usage_minutes)}
                </dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Joined</dt>
                <dd className="mt-1 text-sm text-ink">{formatDate(detail.created_at)}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Last sign-in</dt>
                <dd className="mt-1 text-sm text-ink">{formatRelative(detail.last_login)}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Sign-in method</dt>
                <dd className="mt-1 text-sm text-ink">{providerLabel(detail.auth_provider)}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase text-ink-3">Account ID</dt>
                <dd className="mt-1 font-mono text-cap text-ink-2" title={detail.id}>
                  {detail.id.slice(0, 8)}…
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button
                variant="secondary"
                size="sm"
                icon={<CheckCircle2 size={13} />}
                disabled={detail.status === 'active'}
                onClick={() => void setStatus(detail, 'active')}
              >
                Active
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<PauseCircle size={13} />}
                disabled={detail.status === 'inactive'}
                onClick={() => void setStatus(detail, 'inactive')}
              >
                Inactive
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Ban size={13} />}
                disabled={detail.status === 'blocked'}
                onClick={() => void setStatus(detail, 'blocked')}
              >
                Blocked
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ------------------------------------------------ delete confirmation */}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
        danger
        loading={busyId !== null && busyId === toDelete?.id}
        title="Delete this account?"
        body={
          toDelete
            ? `${toDelete.full_name} (${toDelete.email}) will be removed along with every session, lecture and ticket they own. This can’t be undone — blocking them instead keeps the data.`
            : undefined
        }
        confirmLabel="Delete account"
      />
    </div>
  );
}

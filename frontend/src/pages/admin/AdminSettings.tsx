import React, { useCallback, useEffect, useState } from 'react';
import {
  Boxes,
  Database,
  RotateCw,
  Save,
  Server,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  api,
  formatDate,
  formatRelative,
  titleCaseStatus,
  type ApiUser,
} from '../../lib/api';
import { rag, type ChromaStats } from '../../lib/rag';
import {
  Avatar,
  Button,
  Card,
  Field,
  Input,
  Skeleton,
  SkeletonText,
  Spinner,
  Tag,
  useToast,
} from '../../components/ui';
import { AdminHeader, LoadFailure, accountTone } from './parts';

const API_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : import.meta.env.DEV
      ? 'http://localhost:8000/api'
      : `${window.location.origin}/api`;

type Health = 'checking' | 'up' | 'down';

/** One key/value line in the platform cards. */
function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="shrink-0 text-cap text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-ink">{children}</dd>
    </div>
  );
}

function HealthPill({ state }: { state: Health }) {
  if (state === 'checking') {
    return (
      <Tag tone="neutral">
        <Spinner size={11} />
        Checking
      </Tag>
    );
  }
  return state === 'up' ? (
    <Tag tone="mint">
      <Wifi size={11} />
      Reachable
    </Tag>
  ) : (
    <Tag tone="rose">
      <WifiOff size={11} />
      Unreachable
    </Tag>
  );
}

/**
 * Admin settings — your own account, plus an honest read of the services this
 * browser is talking to. Anything not yet wired to a backend says so.
 */
export function AdminSettings() {
  const { toast } = useToast();

  const [me, setMe] = useState<ApiUser | null>(null);
  const [loadError, setLoadError] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  const [apiHealth, setApiHealth] = useState<Health>('checking');
  const [ragHealth, setRagHealth] = useState<Health>('checking');
  const [stats, setStats] = useState<ChromaStats | null>(null);
  const [statsError, setStatsError] = useState('');

  const loadProfile = useCallback(() => {
    setLoadError('');
    setMe(null);
    api
      .me()
      .then((u) => {
        setMe(u);
        setFullName(u.full_name);
      })
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : 'Could not load your account.'),
      );
  }, []);

  const probeServices = useCallback(() => {
    setApiHealth('checking');
    setRagHealth('checking');
    setStats(null);
    setStatsError('');

    api
      .analyticsSummary()
      .then(() => setApiHealth('up'))
      .catch(() => setApiHealth('down'));

    rag
      .health()
      .then((ok) => setRagHealth(ok ? 'up' : 'down'))
      .catch(() => setRagHealth('down'));

    rag
      .chromaStats()
      .then(setStats)
      .catch((err: unknown) =>
        setStatsError(err instanceof Error ? err.message : 'The vector store did not answer.'),
      );
  }, []);

  useEffect(() => {
    loadProfile();
    probeServices();
  }, [loadProfile, probeServices]);

  const trimmed = fullName.trim();
  const dirty = me !== null && trimmed !== '' && trimmed !== me.full_name;

  const saveName = async () => {
    if (!me || !dirty || saving) return;
    setSaving(true);
    try {
      const updated = await api.updateMe({ full_name: trimmed });
      setMe(updated);
      setFullName(updated.full_name);
      toast('ok', 'Name updated', `Your profile now reads “${updated.full_name}”.`);
    } catch (err) {
      toast(
        'danger',
        "Couldn't save your name",
        err instanceof Error ? err.message : 'Please try again in a moment.',
      );
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------------- render */

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <AdminHeader
        eyebrow="Settings"
        title="Your account & this platform"
        subtitle="Who you are to Lekta, and what Lekta is running on."
        actions={
          <Button variant="secondary" icon={<RotateCw size={14} />} onClick={probeServices}>
            Re-check services
          </Button>
        }
      />

      {/* ------------------------------------------------------ your account */}
      {loadError ? (
        <LoadFailure
          what="Your account couldn't be loaded."
          message={loadError}
          onRetry={loadProfile}
        />
      ) : me === null ? (
        <>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3.5 w-60" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <SkeletonText lines={3} />
          </Card>
        </>
      ) : (
        <>
          <Card className="p-6 animate-rise">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Avatar name={me.full_name} src={me.avatar_url} size={64} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-h3 text-ink">{me.full_name}</p>
                  <Tag tone="accent">
                    <ShieldCheck size={11} />
                    Admin
                  </Tag>
                  <Tag tone={accountTone(me.status)}>{titleCaseStatus(me.status)}</Tag>
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-2">{me.email}</p>
                <p className="mt-1 text-cap text-ink-3">
                  Admin since {formatDate(me.created_at)} · last sign-in{' '}
                  {formatRelative(me.last_login)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-h3 text-ink">Profile</h2>
            <p className="mt-0.5 text-cap text-ink-3">
              The name people see on your replies to their tickets.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field
                label="Full name"
                htmlFor="admin-full-name"
                className="flex-1"
                hint="Shown on ticket replies and alert notes."
              >
                <Input
                  id="admin-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveName();
                  }}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </Field>
              <Button
                icon={<Save size={15} />}
                loading={saving}
                disabled={!dirty}
                onClick={() => void saveName()}
                className="sm:mb-[26px]"
              >
                Save
              </Button>
            </div>
          </Card>
        </>
      )}

      {/* --------------------------------------------------------- services */}
      <Card className="p-6">
        <h2 className="text-h3 text-ink">Services</h2>
        <p className="mt-0.5 text-cap text-ink-3">
          What this browser is talking to, checked just now.
        </p>
        <dl className="mt-4">
          <FactRow label="Backend API">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="font-mono text-cap text-ink-2">{API_URL}</span>
              <HealthPill state={apiHealth} />
            </div>
          </FactRow>
          <FactRow label="RAG service">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="font-mono text-cap text-ink-2">{rag.baseUrl()}</span>
              <HealthPill state={ragHealth} />
            </div>
          </FactRow>
          <FactRow label="Build">
            <Tag tone="neutral">{import.meta.env.DEV ? 'Development' : 'Production'}</Tag>
          </FactRow>
        </dl>
      </Card>

      {/* ---------------------------------------------------- vector store */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl bg-sky-tint text-sky-ink">
            <Database size={17} />
          </span>
          <div>
            <h2 className="text-h3 text-ink">Knowledge index</h2>
            <p className="mt-0.5 text-cap text-ink-3">
              The vector store every answer is retrieved from.
            </p>
          </div>
        </div>

        {statsError ? (
          <p className="mt-4 rounded-ctl bg-rose-tint px-3.5 py-3 text-sm text-rose-ink" role="alert">
            {statsError}
          </p>
        ) : stats === null ? (
          <div className="mt-4">
            <SkeletonText lines={4} />
          </div>
        ) : (
          <dl className="mt-4">
            <FactRow label="Chunks indexed">
              <span className="font-mono tabular-nums">{stats.count.toLocaleString()}</span>
            </FactRow>
            <FactRow label="Transcripts">
              <span className="font-mono tabular-nums">{stats.transcripts.toLocaleString()}</span>
            </FactRow>
            <FactRow label="Embedding model">
              <span className="font-mono text-cap">{stats.embedding_model}</span>
            </FactRow>
            <FactRow label="Vector dimensions">
              <span className="font-mono tabular-nums">{stats.vector_dimensions}</span>
            </FactRow>
            <FactRow label="Collection">
              <span className="font-mono text-cap">{stats.collection}</span>
            </FactRow>
            <FactRow label="On disk">
              <span className="font-mono text-cap">{stats.path}</span>
            </FactRow>
          </dl>
        )}

        {stats !== null && (
          <p className="mt-4 flex items-start gap-2 rounded-ctl bg-canvas px-3.5 py-3 text-cap text-ink-2">
            <Boxes size={14} className="mt-0.5 shrink-0 text-ink-3" />
            Lectures are indexed per account. Deleting a lecture from a user&rsquo;s shelf removes
            its chunks from this store too.
          </p>
        )}
      </Card>

      {/* ----------------------------------------------------- security */}
      <Card className="p-6">
        <h2 className="text-h3 text-ink">Security</h2>
        <p className="mt-4 flex items-start gap-2 rounded-ctl bg-canvas px-3.5 py-3 text-cap text-ink-2">
          <Server size={14} className="mt-0.5 shrink-0 text-ink-3" />
          Admin rights are granted in the database, not from this screen — there is deliberately no
          way to promote an account from the browser.
        </p>
      </Card>

    </div>
  );
}
